"""Backup endpoints for the Sidebar Organizer plugin.

Provides a native folder picker and a backup routine that copies the user's
workflows and subgraph blueprints into timestamped folders under a chosen
local directory (e.g. <dir>/20260824_153012/workflows/...). Old backups are
pruned to keep only the most recent N snapshots.
"""

import asyncio
import datetime
import json
import os
import re
import shutil

from aiohttp import web

from folder_paths import get_user_directory
from server import PromptServer

BACKUP_TIMESTAMP_RE = re.compile(r"^\d{8}_\d{6}$")


def user_data_base():
    """Root of the active user's data (workflows/, subgraphs/ live here)."""
    return os.path.join(get_user_directory(), "default")


def run_backup(dest_dir, retain=30):
    """Copy workflows + subgraphs into <dest_dir>/<timestamp>/, prune old ones.

    Runs in a worker thread; returns a JSON-serialisable summary.
    """
    base = user_data_base()
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    target = os.path.join(dest_dir, stamp)
    os.makedirs(target, exist_ok=True)

    counts = {"workflows": 0, "subgraphs": 0}
    for name in ("workflows", "subgraphs"):
        src = os.path.join(base, name)
        dst = os.path.join(target, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst, dirs_exist_ok=True)
            counts[name] = sum(len(files) for _, _, files in os.walk(dst))

    with open(os.path.join(target, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "created": stamp,
                "workflows": counts["workflows"],
                "subgraphs": counts["subgraphs"],
                "source": base,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    try:
        retain = max(int(retain), 0)
    except (TypeError, ValueError):
        retain = 30
    if retain > 0:
        entries = sorted(
            d
            for d in os.listdir(dest_dir)
            if BACKUP_TIMESTAMP_RE.match(d)
            and os.path.isdir(os.path.join(dest_dir, d))
        )
        for old in entries[:-retain]:
            shutil.rmtree(os.path.join(dest_dir, old), ignore_errors=True)

    return {"timestamp": stamp, "counts": counts, "backupDir": target}


def _pick_folder_dialog():
    """Show a native directory picker (must run off the event loop thread)."""
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        try:
            path = filedialog.askdirectory(parent=root, title="选择备份文件夹")
        finally:
            root.destroy()
        return path or None
    except Exception:
        return None


routes = PromptServer.instance.routes


@routes.post("/sidebar-organizer/pick-folder")
async def pick_folder(request):
    path = await asyncio.to_thread(_pick_folder_dialog)
    if path:
        return web.json_response({"ok": True, "dir": path})
    return web.json_response(
        {"ok": False, "error": "未选择文件夹，或系统对话框不可用，请手动输入路径"}
    )


@routes.post("/sidebar-organizer/backup")
async def backup(request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    dest = str(body.get("dir") or "").strip()
    if not dest:
        return web.json_response({"ok": False, "error": "未设置备份目录"}, status=400)
    retain = body.get("retain", 30)
    try:
        os.makedirs(dest, exist_ok=True)
    except OSError as e:
        return web.json_response({"ok": False, "error": str(e)}, status=400)
    try:
        result = await asyncio.to_thread(run_backup, dest, retain)
        result["ok"] = True
        result["dir"] = dest
        return web.json_response(result)
    except Exception as e:  # noqa: BLE001 - surface any copy error to the UI
        return web.json_response({"ok": False, "error": str(e)}, status=500)
