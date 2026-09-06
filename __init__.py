"""ComfyUI Sidebar Organizer.

Frontend-only extension that adds a left sidebar tab for organizing
workflows and node blueprints into user-defined folders (create/rename/
delete), with drag & drop to categorize items and reorder them. Also
provides a backup area that snapshots workflows + blueprints into a
user-chosen local directory on load / exit / demand.

The plugin ships no backend nodes; `backup.py` only adds backup routes.
"""

import server  # noqa: F401  (ensure PromptServer exists before importing routes)

from . import backup  # noqa: F401  (registers /sidebar-organizer/* routes)

WEB_DIRECTORY = "web"

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
