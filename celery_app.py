from celery import Celery
from celery.schedules import crontab

import os
from pathlib import Path

# Create filesystem directories for Celery
celery_dir = Path("./.celery/data")
(celery_dir / "in").mkdir(parents=True, exist_ok=True)
(celery_dir / "processed").mkdir(parents=True, exist_ok=True)

celery_app = Celery(
    "kairo_worker",
    broker=os.environ.get("CELERY_BROKER_URL", "sqla+sqlite:///celery_broker.db"),
    backend="db+sqlite:///celery_results.db",
    include=["tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Cairo",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=600,
    task_time_limit=900,
    beat_schedule={
        "check-new-chapters-every-3-hours": {
            "task": "check_new_chapters",
            "schedule": crontab(minute=0, hour="*/3"),
            "options": {"queue": "default"},
        },
    },
)
