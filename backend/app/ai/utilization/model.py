"""
Classroom-utilization model.

Predicts how many students will attend each timetable session next week, and
answers "what if this session moved to another slot?".

* Forecaster: scikit-learn HistGradientBoostingRegressor predicting the attendance
  rate (headcount = rate x enrolled) from session type, batch, slot, room, calendar
  facts (exam proximity, holidays) and faculty/section/session history. Its output is
  blended with the session's own past average, weight n/(n+k) on the average: on
  validation weeks the average was already near-optimal for sessions with history,
  while the model was far better for new or changed sessions.
* Slot model: same algorithm without session-level history, so it must learn how day
  and period affect attendance. Used for rescheduling what-ifs.
* 80% prediction intervals are split-conformal calibrated (scaled for group size).

Evaluation is time-based (train on earlier weeks, test on the last 4) against non-ML
baselines, reported separately for existing sessions and for ~15% of sessions held
out entirely (new/changed sessions).
"""
import threading
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, r2_score
from sqlalchemy.orm import Session

from backend.app.models.campus import ClassroomModel, ClassSessionLogModel, TimetableEntryModel
from backend.app.ai.utilization.calendar import (
    HISTORY_WEEKS, batch_group, days_since_exam, days_to_exam, enrolled_for, is_teaching_day,
    near_holiday, session_date, session_kind, week_of,
)
from backend.app.ai.utilization.simulator import simulate_history

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "utilization_model.joblib"
TEST_WEEKS = 4
BLEND_K = 2          # chosen on validation weeks 11–12 (see docs)

CATEGORICAL = ["kind", "group", "department", "location_type", "day", "period"]
HISTORY_FEATURES = ["entry_last", "entry_last3", "entry_prev_mean", "n_past"]
CALENDAR = ["week", "days_to_exam", "days_since_exam", "near_holiday"]
SHARED_NUMERIC = ["enrolled", "capacity", "semester", "faculty_prev_mean", "section_prev_mean"] + CALENDAR
FORECAST_FEATURES = CATEGORICAL + SHARED_NUMERIC + HISTORY_FEATURES
SLOT_FEATURES = CATEGORICAL + SHARED_NUMERIC

FEATURE_LABELS = {
    "kind": "Session type (theory/lab/…)", "group": "Full section / batch / elective",
    "department": "Department", "location_type": "Room type", "day": "Day of week",
    "period": "Period", "enrolled": "Students enrolled", "capacity": "Room capacity",
    "semester": "Semester", "week": "Week of semester", "days_to_exam": "Days until exams",
    "days_since_exam": "Days since exams", "near_holiday": "Next to a holiday",
    "faculty_prev_mean": "Faculty's past attendance", "section_prev_mean": "Section's past attendance",
    "entry_last": "Last week's attendance", "entry_last3": "Last 3 weeks' attendance",
    "entry_prev_mean": "Session's average attendance", "n_past": "Sessions held so far",
}

_lock = threading.Lock()
_cache = {}


# ── Data ──────────────────────────────────────────────────────────────────────
def _entry_frame(db: Session) -> pd.DataFrame:
    rooms = {r.id: r for r in db.query(ClassroomModel).all()}
    rows = []
    for e in db.query(TimetableEntryModel).filter(TimetableEntryModel.is_active == True).all():
        room = rooms.get(e.classroom_id)
        loc = room.location_type if room else "CLASSROOM"
        rows.append({
            "entry_id": e.id, "day": e.day_of_week, "period": e.period_number,
            "start_time": e.start_time, "end_time": e.end_time,
            "classroom_id": e.classroom_id, "capacity": room.capacity if room else 60,
            "location_type": loc, "subject": e.subject_name, "kind": session_kind(e.subject_name, loc),
            "group": batch_group(e.batch), "batch": e.batch, "department": e.department,
            "semester": e.semester, "section": e.section,
            "faculty_key": e.faculty_id or e.faculty_name, "faculty_name": e.faculty_name,
            "enrolled": enrolled_for(e.section, e.batch),
        })
    return pd.DataFrame(rows)


def _add_calendar(df: pd.DataFrame) -> pd.DataFrame:
    dates = pd.to_datetime(df["date"]).dt.date
    df["week"] = dates.map(week_of)
    df["days_to_exam"] = dates.map(days_to_exam)
    df["days_since_exam"] = dates.map(days_since_exam)
    df["near_holiday"] = dates.map(near_holiday)
    return df


def _history_frame(db: Session, entries: pd.DataFrame) -> pd.DataFrame:
    logs = pd.read_sql(
        db.query(ClassSessionLogModel.date, ClassSessionLogModel.timetable_entry_id,
                 ClassSessionLogModel.enrolled, ClassSessionLogModel.present,
                 ClassSessionLogModel.capacity).statement,
        db.bind,
    ).rename(columns={"timetable_entry_id": "entry_id"})
    if logs.empty:
        return logs
    logs["date"] = pd.to_datetime(logs["date"])
    df = logs.merge(entries.drop(columns=["enrolled", "capacity"]), on="entry_id", how="inner")
    df = _add_calendar(df)
    df["rate"] = (df["present"] / df["enrolled"]).clip(0, 1)
    return df.sort_values(["date", "entry_id"]).reset_index(drop=True)


def _prior_group_mean(df: pd.DataFrame, key: str) -> np.ndarray:
    """Mean rate of earlier-dated sessions in the same group (no same-day leakage).
    Only rows with contrib=True count, so held-out sessions don't leak into it."""
    src = df[df["contrib"]]
    daily = src.groupby([key, "date"])["rate"].agg(["sum", "count"]).reset_index().sort_values([key, "date"])
    daily["cum_sum"] = daily.groupby(key)["sum"].cumsum()
    daily["cum_n"] = daily.groupby(key)["count"].cumsum()
    out = np.full(len(df), np.nan)
    for k, grp in df.groupby(key):
        d = daily[daily[key] == k]
        if d.empty:
            continue
        # cumulative totals strictly before each row's date
        idx = np.searchsorted(d["date"].values, grp["date"].values, side="left") - 1
        ok = idx >= 0
        vals = np.full(len(grp), np.nan)
        vals[ok] = d["cum_sum"].values[idx[ok]] / d["cum_n"].values[idx[ok]]
        out[df.index.get_indexer(grp.index)] = vals
    return out


def _add_history_features(df: pd.DataFrame, cold_entries=frozenset()) -> pd.DataFrame:
    """Lag features. Sessions in `cold_entries` are treated as brand new: no history of
    their own, and they don't contribute to faculty/section averages."""
    df = df.sort_values(["entry_id", "date"]).copy()
    g = df.groupby("entry_id")["rate"]
    df["entry_last"] = g.shift(1)
    df["entry_last3"] = g.transform(lambda s: s.shift(1).rolling(3, min_periods=1).mean())
    df["entry_prev_mean"] = g.transform(lambda s: s.shift(1).expanding().mean())
    df["n_past"] = df.groupby("entry_id").cumcount()
    cold = df["entry_id"].isin(cold_entries)
    df.loc[cold, HISTORY_FEATURES] = np.nan
    df.loc[cold, "n_past"] = 0
    df["contrib"] = ~cold
    df = df.sort_values(["date", "entry_id"]).reset_index(drop=True)
    df["faculty_prev_mean"] = _prior_group_mean(df, "faculty_key")
    df["section_prev_mean"] = _prior_group_mean(df, "section")
    return df


def _as_model_input(df: pd.DataFrame, features) -> pd.DataFrame:
    X = df[features].copy()
    for c in CATEGORICAL:
        if c in X:
            X[c] = X[c].astype(str).astype("category")
    return X


def _align_categories(X: pd.DataFrame, categories: dict) -> pd.DataFrame:
    for c, cats in categories.items():
        if c in X:
            X[c] = pd.Categorical(X[c].astype(str), categories=cats)
    return X


def _new_model(**kw):
    return HistGradientBoostingRegressor(
        max_iter=250, learning_rate=0.06, max_leaf_nodes=31, min_samples_leaf=20,
        l2_regularization=0.1, categorical_features="from_dtype", random_state=7, **kw,
    )


# ── Training & evaluation ─────────────────────────────────────────────────────
def _source_counts(db: Session) -> dict:
    from sqlalchemy import func
    rows = db.query(ClassSessionLogModel.source, func.count()).group_by(ClassSessionLogModel.source).all()
    return {source: int(n) for source, n in rows}


def _fit(df: pd.DataFrame, features, categories):
    X = _align_categories(_as_model_input(df, features), categories)
    return _new_model().fit(X, df["rate"])


def _predict(model, df, features, categories):
    X = _align_categories(_as_model_input(df, features), categories)
    return np.clip(model.predict(X), 0, 1)


def _blend(model_rate: np.ndarray, df: pd.DataFrame) -> np.ndarray:
    """Shrink towards the session's own past average as its history grows:
    weight n/(n+k) on the average. k was chosen on validation weeks."""
    n = df["n_past"].fillna(0).values
    w = n / (n + BLEND_K)
    avg = df["entry_prev_mean"].fillna(0).values
    return np.clip(w * avg + (1 - w) * model_rate, 0, 1)


def _scale(rate: np.ndarray, enrolled: np.ndarray) -> np.ndarray:
    """Expected spread of an attendance rate: binomial term + day-to-day term."""
    return np.sqrt(np.maximum(rate * (1 - rate), 0.02) / np.maximum(enrolled, 1)) + 0.02


def _conformal_quantile(y, pred, enrolled, coverage=0.80) -> float:
    """Split-conformal: scaled-residual quantile giving `coverage` on new data."""
    scores = np.abs(y - pred) / _scale(pred, enrolled)
    n = len(scores)
    return float(np.quantile(scores, min(1.0, np.ceil((n + 1) * coverage) / n)))


def _interval(pred, enrolled, q):
    half = q * _scale(pred, enrolled)
    lo = np.floor(np.clip(pred - half, 0, 1) * enrolled).astype(int)
    hi = np.ceil(np.clip(pred + half, 0, 1) * enrolled).astype(int)
    return lo, hi


def _headcount_metrics(df, rate_pred):
    actual = df["present"].values
    pred = rate_pred * df["enrolled"].values
    return {
        "mae_students": round(float(mean_absolute_error(actual, pred)), 2),
        "rmse_students": round(float(np.sqrt(np.mean((actual - pred) ** 2))), 2),
        "r2": round(float(r2_score(actual, pred)), 3),
    }


def _improvement(model_mae, baseline_mae):
    return round(100 * (1 - model_mae / baseline_mae), 1)


def train(db: Session) -> dict:
    """Evaluate on held-out data, then (re)train on the full history."""
    simulate_history(db)                     # no-op if history already exists
    entries = _entry_frame(db)
    hist = _history_frame(db, entries)
    if hist.empty:
        raise RuntimeError("No class session history to train on.")

    last_week = int(hist["week"].max())
    split = last_week - TEST_WEEKS
    categories = {c: sorted(hist[c].astype(str).unique()) for c in CATEGORICAL}

    # ~15% of sessions are held out entirely to measure new/changed-session performance
    rng = np.random.default_rng(11)
    ids = np.array(sorted(entries["entry_id"]))
    cold = frozenset(rng.choice(ids, size=max(1, int(0.15 * len(ids))), replace=False).tolist())

    ev = _add_history_features(hist, cold_entries=cold)
    is_cold = ev["entry_id"].isin(cold)
    train_df = ev[(ev["week"] <= split) & ~is_cold]
    warm_test = ev[(ev["week"] > split) & ~is_cold]
    cold_test = ev[(ev["week"] > split) & is_cold]

    # Interval calibration: model fitted on earlier weeks, scored on the last 2 training weeks
    proper, calib = train_df[train_df["week"] <= split - 2], train_df[train_df["week"] > split - 2]
    calib_model = _fit(proper, FORECAST_FEATURES, categories)
    calib_pred = _blend(_predict(calib_model, calib, FORECAST_FEATURES, categories), calib)
    q = _conformal_quantile(calib["rate"].values, calib_pred, calib["enrolled"].values)

    forecaster = _fit(train_df, FORECAST_FEATURES, categories)
    slot_model = _fit(train_df, SLOT_FEATURES, categories)

    def evaluate(test):
        pred = _blend(_predict(forecaster, test, FORECAST_FEATURES, categories), test)
        lo, hi = _interval(pred, test["enrolled"].values, q)
        y = test["present"].values
        return pred, round(float(np.mean((y >= lo) & (y <= hi))), 3)

    fill = float(train_df["rate"].mean())
    warm_pred, warm_cov = evaluate(warm_test)
    cold_pred, cold_cov = evaluate(cold_test)
    session_avg = warm_test["entry_prev_mean"].fillna(fill).values
    last_week_rate = warm_test["entry_last"].fillna(warm_test["entry_prev_mean"]).fillna(fill).values
    kind_avg = cold_test["kind"].map(train_df.groupby("kind")["rate"].mean()).fillna(fill).values

    warm = {
        "model": _headcount_metrics(warm_test, warm_pred),
        "baseline_session_average": _headcount_metrics(warm_test, session_avg),
        "baseline_last_week": _headcount_metrics(warm_test, last_week_rate),
        "interval_coverage_80": warm_cov,
        "rows": int(len(warm_test)),
    }
    warm["improvement_pct"] = _improvement(
        warm["model"]["mae_students"],
        min(warm["baseline_session_average"]["mae_students"], warm["baseline_last_week"]["mae_students"]))
    cold_metrics = {
        "model": _headcount_metrics(cold_test, cold_pred),
        "baseline_session_type_average": _headcount_metrics(cold_test, kind_avg),
        "interval_coverage_80": cold_cov,
        "rows": int(len(cold_test)), "sessions": len(cold),
    }
    cold_metrics["improvement_pct"] = _improvement(
        cold_metrics["model"]["mae_students"], cold_metrics["baseline_session_type_average"]["mae_students"])
    slot_metrics = {
        "model": _headcount_metrics(cold_test, _predict(slot_model, cold_test, SLOT_FEATURES, categories)),
        "note": "What-if model, scored on new sessions (it never uses a session's own history).",
    }

    # Which inputs the ML model relies on (permutation importance on new sessions, where only the model is used)
    X_cold = _align_categories(_as_model_input(cold_test, FORECAST_FEATURES), categories)
    imp = permutation_importance(forecaster, X_cold, cold_test["rate"], n_repeats=3, random_state=7,
                                 scoring="neg_mean_absolute_error")
    importances = sorted(
        ({"feature": f, "label": FEATURE_LABELS.get(f, f), "importance": round(float(v), 4)}
         for f, v in zip(FORECAST_FEATURES, imp.importances_mean) if f not in HISTORY_FEATURES),
        key=lambda d: -d["importance"],
    )

    # Final models on all history (every session contributes)
    full = _add_history_features(hist)
    bundle = {
        "forecaster": _fit(full, FORECAST_FEATURES, categories),
        "slot_model": _fit(full, SLOT_FEATURES, categories),
        "interval_q": q,
        "categories": categories,
        "fingerprint": _fingerprint(db),
        "info": {
            "algorithm": "HistGradientBoostingRegressor (scikit-learn), blended with each session's past average",
            "target": "Attendance rate per session (headcount = rate × enrolled)",
            "blend": f"weight on a session's own average = n / (n + {BLEND_K}), n = sessions held so far",
            "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "training_rows": int(len(full)),
            "train_weeks": f"1–{split}", "test_weeks": f"{split + 1}–{last_week}",
            "history_weeks": last_week,
            "data_sources": _source_counts(db),
            "metrics": {"existing_sessions": warm, "new_sessions": cold_metrics, "slot_model": slot_metrics},
            "feature_importance": importances,
        },
    }
    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, ARTIFACT)
    _cache.clear()
    _cache["bundle"] = bundle
    return bundle["info"]


def _fingerprint(db: Session) -> dict:
    """Identifies the data a saved model was trained on."""
    return {"database": str(db.bind.url), "sessions": db.query(ClassSessionLogModel.id).count()}


def get_bundle(db: Session) -> dict:
    """Load the trained models, training them first if needed. A saved model is only
    reused if it was trained on this database with the same amount of history."""
    with _lock:
        if "bundle" in _cache:
            return _cache["bundle"]
        if ARTIFACT.exists():
            try:
                bundle = joblib.load(ARTIFACT)
                if bundle.get("fingerprint") == _fingerprint(db):
                    _cache["bundle"] = bundle
                    return bundle
            except Exception:
                pass                         # incompatible/corrupt artifact: retrain
        train(db)
        return _cache["bundle"]


# ── Forecasting ───────────────────────────────────────────────────────────────
def _future_frame(db: Session, week: int) -> pd.DataFrame:
    entries = _entry_frame(db)
    hist = _history_frame(db, entries)
    df = entries.copy()
    df["date"] = [session_date(week, d) for d in df["day"]]
    df = df[[is_teaching_day(d) for d in df["date"]]].copy()
    if df.empty:
        return df
    df = _add_calendar(df)
    if hist.empty:
        for c in HISTORY_FEATURES + ["faculty_prev_mean", "section_prev_mean"]:
            df[c] = np.nan
        df["n_past"] = 0
        return df

    hist = hist.sort_values("date")
    by_entry = hist.groupby("entry_id")["rate"]
    stats = pd.DataFrame({
        "entry_last": by_entry.last(),
        "entry_last3": by_entry.apply(lambda s: s.tail(3).mean()),
        "entry_prev_mean": by_entry.mean(),
        "n_past": by_entry.count(),
    })
    df = df.merge(stats, left_on="entry_id", right_index=True, how="left")
    df["n_past"] = df["n_past"].fillna(0)
    df["faculty_prev_mean"] = df["faculty_key"].map(hist.groupby("faculty_key")["rate"].mean())
    df["section_prev_mean"] = df["section"].map(hist.groupby("section")["rate"].mean())
    return df.reset_index(drop=True)


def default_forecast_week() -> int:
    return HISTORY_WEEKS + 1


def forecast(db: Session, week: int = None) -> pd.DataFrame:
    week = week or default_forecast_week()
    bundle = get_bundle(db)
    df = _future_frame(db, week)
    if df.empty:
        return df
    cats = bundle["categories"]
    rate = _blend(_predict(bundle["forecaster"], df, FORECAST_FEATURES, cats), df)
    lo, hi = _interval(rate, df["enrolled"].values, bundle["interval_q"])
    df["predicted_rate"] = rate
    df["predicted_present"] = np.round(rate * df["enrolled"]).astype(int)
    df["predicted_low"] = np.minimum(lo, df["predicted_present"])
    df["predicted_high"] = np.maximum(hi, df["predicted_present"])
    df["seat_utilization"] = df["predicted_present"] / df["capacity"]
    return df


def what_if_rates(db: Session, rows: pd.DataFrame) -> np.ndarray:
    """Slot-model attendance rate for (possibly hypothetical) sessions. `rows` needs the
    forecast columns plus 'day', 'period' and 'date' for the slot being evaluated."""
    bundle = get_bundle(db)
    df = _add_calendar(rows.copy())
    return _predict(bundle["slot_model"], df, SLOT_FEATURES, bundle["categories"])
