/**
 * ComfyUI Sidebar Organizer
 *
 * Adds a "整理" (Organizer) tab to the left sidebar of ComfyUI.
 *
 * Features:
 *  - Create / rename / delete folders for workflows and node blueprints.
 *  - Drag workflows / blueprints into folders to categorize them.
 *  - Drag items inside a folder (or the unfiled list) to reorder them.
 *  - Drag folders to reorder them.
 *  - Double click a workflow to open it; context menus for move/rename/delete.
 *
 * The organization is metadata-only: it is stored in the user data file
 * `sidebar-organizer/config.json` and never moves or modifies your actual
 * workflow / blueprint files.
 *
 * Loaded as an ES module by ComfyUI's extension loader (dynamic import),
 * so it imports the official legacy shims `scripts/app.js` / `scripts/api.js`.
 */
import { app } from '/scripts/app.js'
import { api } from '/scripts/api.js'

const EXTENSION_NAME = 'ComfyUI.SidebarOrganizer'
const TAB_ID = 'sidebar-organizer'
const CONFIG_PATH = 'sidebar-organizer/config.json'
const CONFIG_VERSION = 1

const SECTION_WORKFLOWS = 'workflows'
const SECTION_BLUEPRINTS = 'blueprints'

const SECTION_TITLES = {
  [SECTION_WORKFLOWS]: '工作流',
  [SECTION_BLUEPRINTS]: '节点蓝图'
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const STYLES = `
.sorg-root {
  --sorg-bg: var(--content-bg, #1e1e1e);
  --sorg-fg: var(--fg-color, #cccccc);
  --sorg-muted: var(--descrip-text, #8a8a8a);
  --sorg-border: var(--border-color, #3a3a3a);
  --sorg-hover: var(--content-hover-bg, #2a2a2a);
  --sorg-accent: var(--comfy-menu-bg, #333333);
  --sorg-input: var(--comfy-input-bg, #242424);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  color: var(--sorg-fg);
  background: var(--sorg-bg);
  font-size: 13px;
  line-height: 1.4;
  user-select: none;
}
.sorg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 8px;
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--sorg-bg);
  border-bottom: 1px solid var(--sorg-border);
}
.sorg-header-title {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sorg-refresh-btn {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--sorg-muted);
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
}
.sorg-refresh-btn:hover {
  background: var(--sorg-hover);
  color: var(--sorg-fg);
}
.sorg-scroll {
  flex: 1;
  min-height: 0;
  padding: 4px 8px 12px;
}
.sorg-section-wrap {
  margin-top: 10px;
}
.sorg-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 4px;
}
.sorg-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--sorg-fg);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex: 1;
}
.sorg-count {
  font-size: 11px;
  color: var(--sorg-muted);
  background: var(--sorg-input);
  border-radius: 999px;
  padding: 1px 7px;
  min-width: 18px;
  text-align: center;
}
.sorg-add-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--sorg-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
.sorg-add-btn:hover {
  background: var(--sorg-hover);
  color: var(--sorg-fg);
}
.sorg-folder {
  margin: 1px 0;
}
.sorg-folder-row,
.sorg-root-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  cursor: pointer;
}
.sorg-folder-row:hover,
.sorg-root-head:hover {
  background: var(--sorg-hover);
}
.sorg-folder-row.sorg-drop-folder,
.sorg-root-head.sorg-drop-folder {
  outline: 1px dashed var(--sorg-muted);
  outline-offset: -1px;
  background: var(--sorg-hover);
}
.sorg-folder-row.sorg-drop-before {
  box-shadow: 0 -2px 0 0 var(--sorg-muted) inset;
}
.sorg-chevron {
  font-size: 12px;
  color: var(--sorg-muted);
  transition: transform 0.12s ease;
  flex-shrink: 0;
}
.sorg-chevron-open {
  transform: rotate(90deg);
}
.sorg-folder-icon {
  font-size: 14px;
  color: var(--sorg-muted);
  flex-shrink: 0;
}
.sorg-folder-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sorg-folder-items {
  margin-left: 14px;
  border-left: 1px solid var(--sorg-border);
  padding-left: 2px;
}
.sorg-folder-items.sorg-collapsed {
  display: none;
}
.sorg-root-group {
  margin: 6px 0 2px;
}
.sorg-root-head {
  color: var(--sorg-muted);
}
.sorg-root-head.sorg-drop-root,
.sorg-root-items.sorg-drop-root {
  outline: 1px dashed var(--sorg-muted);
  outline-offset: -1px;
  border-radius: 6px;
}
.sorg-root-icon {
  font-size: 13px;
  flex-shrink: 0;
}
.sorg-root-label {
  flex: 1;
  font-size: 12px;
}
.sorg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 6px;
  border-radius: 6px;
  cursor: grab;
}
.sorg-item:hover {
  background: var(--sorg-hover);
}
.sorg-item.sorg-dragging {
  opacity: 0.45;
}
.sorg-item.sorg-drop-before {
  box-shadow: 0 -2px 0 0 var(--sorg-muted) inset;
}
.sorg-item.sorg-drop-after {
  box-shadow: 0 2px 0 0 var(--sorg-muted) inset;
}
.sorg-item-icon {
  font-size: 13px;
  color: var(--sorg-muted);
  flex-shrink: 0;
}
.sorg-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sorg-menu-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--sorg-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  opacity: 0;
}
.sorg-folder-row:hover .sorg-menu-btn,
.sorg-item:hover .sorg-menu-btn {
  opacity: 1;
}
.sorg-menu-btn:hover {
  background: var(--sorg-input);
  color: var(--sorg-fg);
}
.sorg-menu {
  /* Explicit dark palette: the menu floats on document.body, outside the
     themed .sorg-root scope, so theme CSS variables are unreliable here. */
  position: fixed;
  z-index: 9999;
  min-width: 150px;
  max-width: 280px;
  background: #1e1e1e;
  color: #e4e4e7;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.6);
  font-size: 13px;
}
.sorg-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  color: #e4e4e7;
}
.sorg-menu-item:hover {
  background: #3b3b40;
  color: #ffffff;
}
.sorg-menu-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sorg-menu-arrow {
  color: #a1a1aa;
  font-size: 11px;
}
.sorg-menu-sep {
  height: 1px;
  background: #3f3f46;
  margin: 4px 6px;
}
.sorg-submenu {
  position: fixed;
}
.sorg-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--sorg-muted);
}
.sorg-backup {
  margin-top: 14px;
  padding: 10px 8px 4px;
  border-top: 1px solid var(--sorg-border);
}
.sorg-backup-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.sorg-backup-dir {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 8px;
}
.sorg-backup-dir-label {
  color: var(--sorg-muted);
  flex-shrink: 0;
}
.sorg-backup-dir-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
  text-align: left;
}
.sorg-backup-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.sorg-btn {
  border: 1px solid var(--sorg-border);
  background: var(--sorg-input);
  color: var(--sorg-fg);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.sorg-btn:hover {
  background: var(--sorg-hover);
}
.sorg-btn-primary {
  background: #2b4a6f;
  border-color: #3a6ea5;
  color: #fff;
}
.sorg-btn-primary:hover {
  background: #35618f;
}
.sorg-backup-opts {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--sorg-muted);
  margin-bottom: 4px;
}
.sorg-retain-input {
  width: 52px;
  background: var(--sorg-input);
  border: 1px solid var(--sorg-border);
  color: var(--sorg-fg);
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 12px;
}
.sorg-backup-note {
  font-size: 11px;
  color: var(--sorg-muted);
  margin-bottom: 2px;
}
.sorg-backup-last {
  font-size: 11px;
  color: var(--sorg-muted);
}
`

let stylesInjected = false

function injectStyles() {
  if (stylesInjected) return
  stylesInjected = true
  const el = document.createElement('style')
  el.id = 'sidebar-organizer-styles'
  el.textContent = STYLES
  document.head.appendChild(el)
}

/* ------------------------------------------------------------------ */
/* Small DOM helpers                                                   */
/* ------------------------------------------------------------------ */

function h(tag, attrs, ...children) {
  attrs ??= {}
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue
    if (key === 'class') el.className = value
    else if (key === 'dataset') Object.assign(el.dataset, value)
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value)
    } else if (key === 'text') el.textContent = value
    else el.setAttribute(key, value === true ? '' : value)
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return el
}

function uid() {
  return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

/* ------------------------------------------------------------------ */
/* Config persistence                                                  */
/* ------------------------------------------------------------------ */

let config = null

function blankConfig() {
  return {
    version: CONFIG_VERSION,
    [SECTION_WORKFLOWS]: { folders: [], rootOrder: [] },
    [SECTION_BLUEPRINTS]: { folders: [], rootOrder: [] },
    backup: { dir: '', retain: 30, lastBackup: '' }
  }
}

function ensureConfig() {
  if (config) return
  config = blankConfig()
}

function sanitizeFolder(raw) {
  return {
    id: String(raw.id),
    name: String(raw.name),
    items: Array.isArray(raw.items)
      ? raw.items.filter((p) => typeof p === 'string')
      : [],
    folders: Array.isArray(raw.folders)
      ? raw.folders
          .filter(
            (f) =>
              f &&
              typeof f === 'object' &&
              typeof f.id === 'string' &&
              typeof f.name === 'string'
          )
          .map(sanitizeFolder)
      : []
  }
}

function sanitizeSection(raw) {
  const folders = Array.isArray(raw?.folders)
    ? raw.folders
        .filter(
          (f) =>
            f &&
            typeof f === 'object' &&
            typeof f.id === 'string' &&
            typeof f.name === 'string'
        )
        .map(sanitizeFolder)
    : []
  const rootOrder = Array.isArray(raw?.rootOrder)
    ? raw.rootOrder.filter((p) => typeof p === 'string')
    : []
  return { folders, rootOrder }
}

function sanitizeBackup(raw) {
  return {
    dir: typeof raw?.dir === 'string' ? raw.dir : '',
    retain:
      typeof raw?.retain === 'number' && Number.isFinite(raw.retain)
        ? Math.max(1, Math.floor(raw.retain))
        : 30,
    lastBackup: typeof raw?.lastBackup === 'string' ? raw.lastBackup : ''
  }
}

function pruneFolder(folder, known) {
  folder.items = folder.items.filter((p) => known.has(p))
  for (const sub of folder.folders ?? []) pruneFolder(sub, known)
}

function pruneConfig() {
  // Drop references to files that no longer exist so folder counts stay
  // accurate. Sections with an empty item list are skipped: the store may
  // not have finished loading (e.g. blueprints) yet, and pruning then would
  // wipe valid assignments.
  for (const section of [SECTION_WORKFLOWS, SECTION_BLUEPRINTS]) {
    const items = getSectionItems(section)
    if (items.length === 0) continue
    const known = new Set(items.map((w) => w.path))
    const cfg = config[section]
    for (const folder of cfg.folders) pruneFolder(folder, known)
    cfg.rootOrder = cfg.rootOrder.filter((p) => known.has(p))
  }
}

async function loadConfig() {
  try {
    const resp = await api.getUserData(CONFIG_PATH)
    if (resp.status === 200) {
      const data = await resp.json()
      if (data && typeof data === 'object') {
        config = {
          version: CONFIG_VERSION,
          [SECTION_WORKFLOWS]: sanitizeSection(data[SECTION_WORKFLOWS]),
          [SECTION_BLUEPRINTS]: sanitizeSection(data[SECTION_BLUEPRINTS]),
          backup: sanitizeBackup(data.backup)
        }
      }
    }
  } catch (err) {
    console.error(`[${EXTENSION_NAME}] Failed to load config`, err)
  }
  ensureConfig()
  pruneConfig()
}

async function saveConfig() {
  pruneConfig()
  try {
    await api.storeUserData(CONFIG_PATH, config)
  } catch (err) {
    console.error(`[${EXTENSION_NAME}] Failed to save config`, err)
    toast('保存整理配置失败', err)
  }
}

/* ------------------------------------------------------------------ */
/* Store access                                                       */
/* ------------------------------------------------------------------ */

function workflowStore() {
  return app?.extensionManager?.workflow ?? null
}

function dialog() {
  return app?.extensionManager?.dialog ?? null
}

function notify(summary, detail, severity = 'error') {
  const t = app?.extensionManager?.toast
  if (!t) {
    console.error(`[${EXTENSION_NAME}]`, summary, detail)
    return
  }
  t.add({
    severity,
    summary: String(summary),
    detail: detail ? String(detail) : undefined,
    life: severity === 'success' ? 4000 : 6000
  })
}

function toast(summary, detail) {
  notify(summary, detail, 'error')
}

/**
 * Workflows (persisted, real files) excluding blueprints and dotfiles.
 */
function getWorkflows() {
  const store = workflowStore()
  if (!store) return []
  return (store.workflows ?? []).filter(
    (w) =>
      w.isPersisted &&
      !w.path.startsWith('subgraphs/') &&
      !String(w.fullFilename ?? '').startsWith('.')
  )
}

/**
 * User node blueprints (persisted subgraph blueprint files).
 */
function getBlueprints() {
  const store = workflowStore()
  if (!store) return []
  return (store.workflows ?? []).filter(
    (w) =>
      w.isPersisted &&
      w.path.startsWith('subgraphs/') &&
      !String(w.fullFilename ?? '').startsWith('.')
  )
}

function getSectionItems(section) {
  return section === SECTION_WORKFLOWS ? getWorkflows() : getBlueprints()
}

/**
 * syncWorkflows() re-syncs the workflows directory and, as a side effect,
 * removes every non-workflow entry (i.e. the subgraph blueprints) from the
 * workflow store. Keep references to the blueprint objects and re-attach
 * them so they survive any sync.
 */
let cachedBlueprints = []

function ensureBlueprintsAttached() {
  const store = workflowStore()
  if (!store || typeof store.attachWorkflow !== 'function') return
  for (const bp of cachedBlueprints) {
    if (!store.workflows.some((w) => w.path === bp.path)) {
      store.attachWorkflow(bp)
    }
  }
  cachedBlueprints = store.workflows.filter(
    (w) => w.path.startsWith('subgraphs/') && w.isPersisted
  )
}

/* ------------------------------------------------------------------ */
/* UI state                                                            */
/* ------------------------------------------------------------------ */

const ui = {
  root: null,
  expanded: null, // Set of folder ids
  drag: null, // { type: 'item'|'folder', section, path?, fromFolder?, folderId? }
  dropHint: null, // { el, mode: 'before'|'after'|'folder' }
  menu: null
}

function loadExpandedState() {
  try {
    const raw = localStorage.getItem('sidebar-organizer.expanded')
    ui.expanded = new Set(raw ? JSON.parse(raw) : [])
  } catch {
    ui.expanded = new Set()
  }
}

function saveExpandedState() {
  try {
    localStorage.setItem(
      'sidebar-organizer.expanded',
      JSON.stringify([...ui.expanded])
    )
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Model building                                                      */
/* ------------------------------------------------------------------ */

function sectionConfig(section) {
  ensureConfig()
  return config[section]
}

/** Find a folder at any depth. */
function findFolder(section, folderId) {
  const root = sectionConfig(section).folders
  const walk = (folders) => {
    for (const f of folders) {
      if (f.id === folderId) return f
      const r = walk(f.folders ?? [])
      if (r) return r
    }
    return null
  }
  return walk(root)
}

/** Locate the container list holding a folder: { list, parentId, index }. */
function findFolderContainer(section, folderId) {
  const root = sectionConfig(section).folders
  const idx = root.findIndex((f) => f.id === folderId)
  if (idx !== -1) return { list: root, parentId: null, index: idx }
  const walk = (folders, parentId) => {
    for (const f of folders) {
      const subs = f.folders ?? []
      const i = subs.findIndex((s) => s.id === folderId)
      if (i !== -1) return { list: subs, parentId: f.id, index: i }
      const r = walk(subs, f.id)
      if (r) return r
    }
    return null
  }
  return walk(root, null)
}

/** Remove a folder from wherever it lives; returns the folder object. */
function removeFolderFromContainer(section, folderId) {
  const info = findFolderContainer(section, folderId)
  if (!info || info.index === -1) return null
  const [folder] = info.list.splice(info.index, 1)
  return folder ?? null
}

/** True when `folderId` is a descendant of `ancestorId`. */
function isDescendantFolder(section, ancestorId, folderId) {
  const ancestor = findFolder(section, ancestorId)
  if (!ancestor) return false
  let found = false
  const walk = (folders) => {
    for (const f of folders) {
      if (f.id === folderId) {
        found = true
        return
      }
      if (!found) walk(f.folders ?? [])
    }
  }
  walk(ancestor.folders ?? [])
  return found
}

/** Number of descendant folders (not counting the folder itself). */
function countSubfolders(folder) {
  return (folder.folders ?? []).reduce(
    (n, sub) => n + 1 + countSubfolders(sub),
    0
  )
}

/** Total number of items inside a folder, including descendants. */
function countItemsRecursive(folder) {
  return (
    folder.items.length +
    (folder.folders ?? []).reduce(
      (n, sub) => n + countItemsRecursive(sub),
      0
    )
  )
}

function sortByOrder(items, order) {
  const rank = new Map(order.map((p, i) => [p, i]))
  return [...items].sort(
    (a, b) =>
      (rank.has(a.path) ? rank.get(a.path) : Number.MAX_SAFE_INTEGER) -
        (rank.has(b.path) ? rank.get(b.path) : Number.MAX_SAFE_INTEGER) ||
      String(a.filename ?? a.fullFilename).localeCompare(
        String(b.filename ?? b.fullFilename),
        'zh'
      )
  )
}

function buildFolderModel(cfgFolder, byPath) {
  return {
    id: cfgFolder.id,
    name: cfgFolder.name,
    items: (cfgFolder.items ?? [])
      .map((p) => byPath.get(p))
      .filter((w) => w !== undefined),
    folders: (cfgFolder.folders ?? []).map((f) => buildFolderModel(f, byPath))
  }
}

/**
 * Build the display model for one section:
 * { folders: [nested model], root: ComfyWorkflow[] }
 */
function buildModel(section) {
  const cfg = sectionConfig(section)
  const items = getSectionItems(section)
  const byPath = new Map(items.map((w) => [w.path, w]))

  const folders = cfg.folders.map((f) => buildFolderModel(f, byPath))

  const assigned = new Set()
  const collectAssigned = (fs) => {
    for (const f of fs) {
      for (const w of f.items) assigned.add(w.path)
      collectAssigned(f.folders)
    }
  }
  collectAssigned(folders)

  const root = sortByOrder(items.filter((w) => !assigned.has(w.path)), cfg.rootOrder)

  return { folders, root }
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

async function createFolder(section) {
  const dlg = dialog()
  const name = dlg
    ? await dlg.prompt({
        title: '新建文件夹',
        message: `为${SECTION_TITLES[section]}新建文件夹：`,
        defaultValue: '',
        placeholder: '文件夹名称'
      })
    : prompt('文件夹名称：')
  if (!name || !name.trim()) return
  const trimmed = name.trim()
  const cfg = sectionConfig(section)
  if (cfg.folders.some((f) => f.name === trimmed)) {
    toast('操作失败', `已存在同名文件夹"${trimmed}"`)
    return
  }
  const folder = { id: uid(), name: trimmed, items: [], folders: [] }
  cfg.folders.push(folder)
  ui.expanded.add(folder.id)
  await saveConfig()
  render()
}

async function createSubfolder(section, parentId) {
  const parent = findFolder(section, parentId)
  if (!parent) return
  const dlg = dialog()
  const name = dlg
    ? await dlg.prompt({
        title: '新建子文件夹',
        message: `在文件夹"${parent.name}"下创建子文件夹：`,
        defaultValue: '',
        placeholder: '子文件夹名称'
      })
    : prompt('子文件夹名称：')
  if (!name || !name.trim()) return
  const trimmed = name.trim()
  parent.folders ??= []
  if (parent.folders.some((f) => f.name === trimmed)) {
    toast('操作失败', `已存在同名子文件夹"${trimmed}"`)
    return
  }
  const sub = { id: uid(), name: trimmed, items: [], folders: [] }
  parent.folders.push(sub)
  ui.expanded.add(parent.id)
  ui.expanded.add(sub.id)
  await saveConfig()
  render()
}

async function renameFolder(section, folderId) {
  const folder = findFolder(section, folderId)
  if (!folder) return
  const dlg = dialog()
  const name = dlg
    ? await dlg.prompt({
        title: '重命名文件夹',
        message: `为文件夹"${folder.name}"输入新名称：`,
        defaultValue: folder.name,
        placeholder: '文件夹名称'
      })
    : prompt('文件夹名称：', folder.name)
  if (!name || !name.trim() || name.trim() === folder.name) return
  const trimmed = name.trim()
  const hasSibling = (folders) =>
    folders.some((f) => f.id !== folderId && f.name === trimmed)
  const info = findFolderContainer(section, folderId)
  const siblings = info?.parentId
    ? (findFolder(section, info.parentId)?.folders ?? [])
    : sectionConfig(section).folders
  if (hasSibling(siblings)) {
    toast('操作失败', `已存在同名文件夹"${trimmed}"`)
    return
  }
  folder.name = trimmed
  await saveConfig()
  render()
}

async function deleteFolder(section, folderId) {
  const folder = findFolder(section, folderId)
  if (!folder) return
  const info = findFolderContainer(section, folderId)
  if (!info || info.index === -1) return
  const dlg = dialog()
  const subCount = countSubfolders(folder)
  const details = []
  if (folder.items.length > 0) details.push(`${folder.items.length} 个项目`)
  if (subCount > 0) details.push(`${subCount} 个子文件夹`)
  const ok = dlg
    ? await dlg.confirm({
        title: '删除文件夹',
        type: 'delete',
        message: `确定删除文件夹"${folder.name}"吗？`,
        hint:
          details.length > 0
            ? `其中 ${details.join('、')}将移至上一级，不会被删除。`
            : '该文件夹为空。',
        itemList: [folder.name]
      })
    : confirm(`确定删除文件夹"${folder.name}"吗？`)
  if (!ok) return

  // Items and subfolders move up one level (to the parent, or root).
  const parentItems = info.parentId
    ? (findFolder(section, info.parentId)?.items ?? [])
    : sectionConfig(section).rootOrder
  parentItems.push(...folder.items)
  const parentFolders = info.parentId
    ? (findFolder(section, info.parentId)?.folders ?? [])
    : sectionConfig(section).folders
  parentFolders.push(...(folder.folders ?? []))
  info.list.splice(info.index, 1)
  ui.expanded.delete(folderId)
  await saveConfig()
  render()
}

/**
 * Move an item to a folder (or to root when folderId is null) at an index.
 */
async function moveItem(section, path, targetFolderId, index = -1) {
  const cfg = sectionConfig(section)
  // Remove from wherever it currently is (any depth).
  const removePath = (folders) => {
    for (const folder of folders) {
      const i = folder.items.indexOf(path)
      if (i !== -1) folder.items.splice(i, 1)
      removePath(folder.folders ?? [])
    }
  }
  removePath(cfg.folders)
  const rootIdx = cfg.rootOrder.indexOf(path)
  if (rootIdx !== -1) cfg.rootOrder.splice(rootIdx, 1)

  if (targetFolderId) {
    const folder = findFolder(section, targetFolderId)
    if (!folder) return
    folder.items ??= []
    if (index < 0 || index > folder.items.length) folder.items.push(path)
    else folder.items.splice(index, 0, path)
  } else {
    if (index < 0 || index > cfg.rootOrder.length) cfg.rootOrder.push(path)
    else cfg.rootOrder.splice(index, 0, path)
  }
  await saveConfig()
  render()
}

/**
 * Move a folder to a target container: a parent folder id (nest, appended or
 * at an index within its subfolder list) or null (root level).
 */
async function moveFolder(section, folderId, targetParentId, index = -1) {
  const moved = removeFolderFromContainer(section, folderId)
  if (!moved) return
  const targetList = targetParentId
    ? (findFolder(section, targetParentId)?.folders ?? null)
    : sectionConfig(section).folders
  if (!targetList) {
    // Fallback: root level.
    sectionConfig(section).folders.push(moved)
  } else {
    if (index < 0 || index > targetList.length) targetList.push(moved)
    else targetList.splice(index, 0, moved)
  }
  await saveConfig()
  render()
}

/** Index of a path inside a container (folder id or null for root), or -1. */
function containerIndexOf(section, path, folderId) {
  if (folderId) {
    const folder = findFolder(section, folderId)
    return folder ? (folder.items ?? []).indexOf(path) : -1
  }
  return sectionConfig(section).rootOrder.indexOf(path)
}

/** Folder id containing a path (any depth), or null when in the root list. */
function findFolderForPath(section, path) {
  const walk = (folders) => {
    for (const f of folders) {
      if (f.items.includes(path)) return f.id
      const r = walk(f.folders ?? [])
      if (r) return r
    }
    return null
  }
  return walk(sectionConfig(section).folders)
}

async function openWorkflow(path) {
  const store = workflowStore()
  const w = store?.workflows?.find((x) => x.path === path)
  if (!store || !w) return
  try {
    await store.openWorkflow(w)
  } catch (err) {
    toast('打开工作流失败', err)
  }
}

async function renameItem(section, path) {
  const store = workflowStore()
  const w = store?.workflows?.find((x) => x.path === path)
  if (!store || !w) return
  const isBlueprint = section === SECTION_BLUEPRINTS
  const dlg = dialog()
  const name = dlg
    ? await dlg.prompt({
        title: isBlueprint ? '重命名节点蓝图' : '重命名工作流',
        message: isBlueprint
          ? `输入蓝图"${w.filename}"的新名称（将同步重命名蓝图文件）：`
          : '输入新的工作流名称：',
        defaultValue: w.filename,
        placeholder: '名称'
      })
    : prompt(isBlueprint ? '蓝图名称：' : '工作流名称：', w.filename)
  if (!name || !name.trim()) return
  const trimmed = name.trim()
  const suffix = w.suffix || 'json'
  const newPath =
    w.directory + '/' + (trimmed.toLowerCase().endsWith('.' + suffix) ? trimmed : trimmed + '.' + suffix)
  if (newPath === w.path) return
  try {
    await store.renameWorkflow(w, newPath)
    // Keep the folder assignment: replace the old path with the new one
    // wherever it appears (any depth).
    const cfg = sectionConfig(section)
    const replacePath = (folders) => {
      for (const folder of folders) {
        const i = folder.items.indexOf(path)
        if (i !== -1) folder.items[i] = w.path
        replacePath(folder.folders ?? [])
      }
    }
    replacePath(cfg.folders)
    const ri = cfg.rootOrder.indexOf(path)
    if (ri !== -1) cfg.rootOrder[ri] = w.path
  } catch (err) {
    toast(isBlueprint ? '重命名蓝图失败' : '重命名失败', err)
  }
  await saveConfig()
  render()
  if (isBlueprint) await promptReloadForBlueprints('重命名')
}

/**
 * Blueprint names are also registered as node types in the node library;
 * that registration only refreshes on page load. Ask the user whether to
 * reload right away so the change is visible everywhere.
 */
async function promptReloadForBlueprints(action) {
  const dlg = dialog()
  const reload = dlg
    ? await dlg.confirm({
        title: `已${action}节点蓝图`,
        type: 'default',
        message: '节点库中的蓝图名称需要刷新页面后才能同步显示。',
        hint: '刷新会重新载入页面，未保存的画布改动可能丢失。是否立即刷新？',
        denyLabel: '稍后再说'
      })
    : true
  if (reload && typeof location !== 'undefined') location.reload()
}

async function deleteItem(section, path) {
  const store = workflowStore()
  const w = store?.workflows?.find((x) => x.path === path)
  if (!store || !w) return
  const isBlueprint = section === SECTION_BLUEPRINTS
  const dlg = dialog()
  const ok = dlg
    ? await dlg.confirm({
        title: isBlueprint ? '删除节点蓝图' : '删除工作流',
        type: 'delete',
        message: `确定删除${isBlueprint ? '节点蓝图' : '工作流'}"${w.filename}"吗？`,
        hint: isBlueprint
          ? '蓝图文件将被删除；已保存工作流中引用该蓝图的节点将无法再解析。'
          : undefined,
        itemList: [w.filename]
      })
    : confirm(`确定删除${isBlueprint ? '节点蓝图' : '工作流'}"${w.filename}"吗？`)
  if (!ok) return
  try {
    await store.deleteWorkflow(w)
    // Drop it from the re-attach cache so it is not resurrected by
    // ensureBlueprintsAttached() on the next render.
    cachedBlueprints = cachedBlueprints.filter((bp) => bp !== w)
  } catch (err) {
    toast(isBlueprint ? '删除蓝图失败' : '删除失败', err)
  }
  await saveConfig()
  render()
  if (isBlueprint) await promptReloadForBlueprints('删除')
}

/* ------------------------------------------------------------------ */
/* Context menu                                                        */
/* ------------------------------------------------------------------ */

function closeMenu() {
  if (ui.menu) {
    ui.menu.remove()
    ui.menu = null
  }
  document.removeEventListener('pointerdown', onMenuOutsideClick, true)
  document.removeEventListener('keydown', onMenuKeydown)
  window.removeEventListener('resize', closeMenu)
}

function onMenuOutsideClick(e) {
  if (ui.menu && !ui.menu.contains(e.target)) closeMenu()
}

function onMenuKeydown(e) {
  if (e.key === 'Escape') closeMenu()
}

function showMenu(anchorEl, entries) {
  closeMenu()
  const menu = h('div', { class: 'sorg-menu' })
  for (const entry of entries) {
    if (entry === null) {
      menu.appendChild(h('div', { class: 'sorg-menu-sep' }))
      continue
    }
    if (entry.submenu) {
      const row = h(
        'div',
        { class: 'sorg-menu-item sorg-menu-item-sub' },
        h('span', { class: 'sorg-menu-label' }, entry.label),
        h('span', { class: 'sorg-menu-arrow' }, '▸')
      )
      row.addEventListener('mouseenter', () => showSubmenu(entry.submenu, row))
      menu.appendChild(row)
    } else {
      const row = h('div', { class: 'sorg-menu-item' }, entry.label)
      row.addEventListener('click', () => {
        closeMenu()
        entry.action?.()
      })
      menu.appendChild(row)
    }
  }
  document.body.appendChild(menu)
  const rect = anchorEl.getBoundingClientRect()
  const mrect = menu.getBoundingClientRect()
  let left = rect.left
  let top = rect.bottom + 4
  if (left + mrect.width > window.innerWidth - 8) left = window.innerWidth - mrect.width - 8
  if (top + mrect.height > window.innerHeight - 8) top = rect.top - mrect.height - 4
  menu.style.left = left + 'px'
  menu.style.top = top + 'px'
  ui.menu = menu
  document.addEventListener('pointerdown', onMenuOutsideClick, true)
  document.addEventListener('keydown', onMenuKeydown)
  window.addEventListener('resize', closeMenu)
}

function showSubmenu(entries, anchorEl) {
  const existing = anchorEl.querySelector('.sorg-submenu')
  if (existing) {
    existing.remove()
    return
  }
  closeSubmenus()
  const sub = h('div', { class: 'sorg-menu sorg-submenu' })
  for (const entry of entries) {
    if (entry === null) {
      sub.appendChild(h('div', { class: 'sorg-menu-sep' }))
      continue
    }
    const row = h('div', { class: 'sorg-menu-item' }, entry.label)
    row.addEventListener('click', () => {
      closeMenu()
      entry.action?.()
    })
    sub.appendChild(row)
  }
  anchorEl.appendChild(sub)
  const rect = anchorEl.getBoundingClientRect()
  const srect = sub.getBoundingClientRect()
  let left = rect.right - 4
  let top = rect.top
  if (left + srect.width > window.innerWidth - 8) left = rect.left - srect.width + 4
  if (top + srect.height > window.innerHeight - 8) top = window.innerHeight - srect.height - 8
  sub.style.left = left + 'px'
  sub.style.top = top + 'px'
}

function closeSubmenus() {
  document.querySelectorAll('.sorg-submenu').forEach((el) => el.remove())
}

/* ------------------------------------------------------------------ */
/* Item / folder menus                                                 */
/* ------------------------------------------------------------------ */

function moveMenuEntries(section, path) {
  const currentFolder = findFolderForPath(section, path)
  const entries = []
  const walk = (folders, depth) => {
    for (const f of folders) {
      if (f.id !== currentFolder) {
        entries.push({
          label: (depth > 0 ? '　'.repeat(depth) + '↳ ' : '') + f.name,
          action: () => moveItem(section, path, f.id)
        })
      }
      walk(f.folders ?? [], depth + 1)
    }
  }
  walk(sectionConfig(section).folders, 0)
  entries.push({
    label: '未分类',
    action: () => moveItem(section, path, null)
  })
  return entries
}

function showItemMenu(ev, section, w) {
  ev.stopPropagation()
  const inFolder = findFolderForPath(section, w.path) !== null
  const entries = []
  if (section === SECTION_WORKFLOWS) {
    entries.push({
      label: '打开',
      action: () => openWorkflow(w.path)
    })
  }
  entries.push({
    label: '移动到',
    submenu: moveMenuEntries(section, w.path)
  })
  if (inFolder) {
    entries.push({
      label: '移出文件夹',
      action: () => moveItem(section, w.path, null)
    })
  }
  entries.push(null)
  entries.push({
    label: '重命名',
    action: () => renameItem(section, w.path)
  })
  entries.push({
    label: '删除',
    action: () => deleteItem(section, w.path)
  })
  showMenu(ev.currentTarget, entries)
}

function showFolderMenu(ev, section, folder) {
  ev.stopPropagation()
  showMenu(ev.currentTarget, [
    {
      label: '新建子文件夹',
      action: () => createSubfolder(section, folder.id)
    },
    { label: '重命名', action: () => renameFolder(section, folder.id) },
    { label: '删除', action: () => deleteFolder(section, folder.id) }
  ])
}

/* ------------------------------------------------------------------ */
/* Drag & drop                                                         */
/* ------------------------------------------------------------------ */

function clearDropHint() {
  if (ui.dropHint) {
    ui.dropHint.el.classList.remove(
      'sorg-drop-before',
      'sorg-drop-after',
      'sorg-drop-folder'
    )
    ui.dropHint = null
  }
}

function onDragStart(e, payload) {
  ui.drag = payload
  e.dataTransfer.effectAllowed = 'move'
  // Required for drag to start in some browsers.
  try {
    e.dataTransfer.setData('text/plain', payload.path ?? payload.folderId ?? '')
    if (payload.type === 'item') {
      e.dataTransfer.setData(
        payload.kind === 'blueprint'
          ? 'application/x-comfy-blueprint'
          : 'application/x-comfy-workflow',
        payload.path
      )
    }
  } catch {
    /* ignore */
  }
  e.currentTarget.classList.add('sorg-dragging')
}

function onDragEnd(e) {
  ui.drag = null
  clearDropHint()
  e.currentTarget.classList.remove('sorg-dragging')
}

function setItemHint(row, mode) {
  if (ui.dropHint && ui.dropHint.el !== row) clearDropHint()
  row.classList.remove('sorg-drop-before', 'sorg-drop-after')
  row.classList.add(mode === 'before' ? 'sorg-drop-before' : 'sorg-drop-after')
  ui.dropHint = { el: row, mode }
}

function onItemDragOver(e, row) {
  if (!ui.drag || ui.drag.type !== 'item') return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  const rect = row.getBoundingClientRect()
  const mode = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  setItemHint(row, mode)
}

function onItemDrop(e, row, section) {
  if (!ui.drag || ui.drag.type !== 'item') return
  e.preventDefault()
  e.stopPropagation()
  const { path } = ui.drag
  const hint = ui.dropHint && ui.dropHint.el === row ? ui.dropHint.mode : 'after'
  const container = row.parentElement
  const rows = [...container.querySelectorAll(':scope > .sorg-item')]
  const targetFolder = row.dataset.folder === '' ? null : row.dataset.folder
  let index = rows.indexOf(row) + (hint === 'after' ? 1 : 0)
  // When reordering inside the same container, account for the item being
  // removed before it is inserted again.
  const sourceFolder = findFolderForPath(section, path)
  if (sourceFolder === targetFolder) {
    const sourceIndex = containerIndexOf(section, path, targetFolder)
    if (sourceIndex !== -1 && sourceIndex < index) index -= 1
  }
  moveItem(section, path, targetFolder, index)
}

function onFolderDragOver(e, row) {
  if (!ui.drag) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (ui.dropHint && ui.dropHint.el !== row) clearDropHint()
  row.classList.remove('sorg-drop-before', 'sorg-drop-after', 'sorg-drop-folder')

  if (ui.drag.type === 'folder') {
    if (ui.drag.folderId === row.dataset.folder) return
    // Top zone: insert before (reorder within the same container).
    // Bottom zone: nest the dragged folder into the target folder.
    const rect = row.getBoundingClientRect()
    const zone =
      e.clientY < rect.top + rect.height * 0.4 ? 'before' : 'nest'
    if (zone === 'before') {
      row.classList.add('sorg-drop-before')
      ui.dropHint = { el: row, mode: 'before' }
    } else {
      row.classList.add('sorg-drop-folder')
      ui.dropHint = { el: row, mode: 'nest' }
    }
    return
  }

  // Item drag: the folder row is a plain "move into folder" target.
  row.classList.add('sorg-drop-folder')
  ui.dropHint = { el: row, mode: 'folder' }
}

function onFolderDrop(e, row, section) {
  if (!ui.drag) return
  e.preventDefault()
  e.stopPropagation()
  const { type } = ui.drag
  const targetFolderId = row.dataset.folder
  if (type === 'item') {
    moveItem(section, ui.drag.path, targetFolderId)
    return
  }
  if (type !== 'folder' || ui.drag.folderId === targetFolderId) return
  if (isDescendantFolder(section, ui.drag.folderId, targetFolderId)) {
    toast('操作失败', '不能把文件夹移入自身或它的子文件夹')
    return
  }
  const hint = ui.dropHint && ui.dropHint.el === row ? ui.dropHint.mode : 'nest'
  if (hint === 'before') {
    // Insert before the target within the target's own container.
    const targetParent = findFolderContainer(section, targetFolderId)
    if (!targetParent || targetParent.index === -1) return
    let index = targetParent.index
    const sourceContainer = findFolderContainer(section, ui.drag.folderId)
    if (
      sourceContainer &&
      sourceContainer.parentId === targetParent.parentId &&
      sourceContainer.index < index
    ) {
      index -= 1
    }
    moveFolder(section, ui.drag.folderId, targetParent.parentId, index)
  } else {
    // Nest into the target folder.
    moveFolder(section, ui.drag.folderId, targetFolderId, -1)
  }
}

function onRootDragOver(e, container) {
  if (!ui.drag) return
  if (ui.drag.type === 'item') {
    if (e.target.closest('.sorg-item')) return // the row shows its own hint
  } else if (ui.drag.type === 'folder') {
    // Only the "未分类" header accepts folder drops (move folder to root end).
    if (!container.classList.contains('sorg-root-head')) return
  } else {
    return
  }
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (ui.dropHint && ui.dropHint.el !== container) clearDropHint()
  container.classList.add('sorg-drop-root')
  ui.dropHint = { el: container, mode: 'root' }
}

function onRootDrop(e, container, section) {
  if (!ui.drag) return
  e.preventDefault()
  e.stopPropagation()

  if (ui.drag.type === 'folder') {
    // Dropping a folder onto "未分类" moves it out to the root level (end).
    moveFolder(section, ui.drag.folderId, null, -1)
    return
  }

  if (ui.drag.type !== 'item') return
  const rows = [...container.querySelectorAll(':scope > .sorg-item')]
  const before = rows.filter((r) => {
    const rect = r.getBoundingClientRect()
    return rect.top + rect.height / 2 < e.clientY
  }).length
  const targetFolder = null
  let index = before
  const sourceFolder = findFolderForPath(section, ui.drag.path)
  if (sourceFolder === targetFolder) {
    const sourceIndex = containerIndexOf(section, ui.drag.path, targetFolder)
    if (sourceIndex !== -1 && sourceIndex < index) index -= 1
  }
  moveItem(section, ui.drag.path, null, index)
}

/* ------------------------------------------------------------------ */
/* Drag to canvas                                                      */
/* ------------------------------------------------------------------ */

function isOverCanvas(clientX, clientY) {
  const canvasEl = app?.canvas?.canvas
  if (!canvasEl) return false
  const rect = canvasEl.getBoundingClientRect()
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return false
  }
  // The graph canvas element may span the whole window beneath the floating
  // side panels, so the rect check alone is not enough: require the pointer
  // to actually be over the graph area, not over the organizer panel or the
  // app chrome (toolbar / side panels / top bar / our floating menus).
  const under = document.elementFromPoint(clientX, clientY)
  if (!under) return false
  if (ui.root && ui.root.contains(under)) return false
  if (
    under.closest &&
    under.closest(
      '.comfyui-body-left, .comfyui-body-top, .comfyui-body-right, ' +
        '.comfyui-body-bottom, .side-bar-panel, .side-toolbar-container, ' +
        '.sidebar-content-container, .sorg-menu'
    )
  ) {
    return false
  }
  return true
}

/** Convert client coordinates to canvas-space coordinates. */
function canvasPosAt(clientX, clientY) {
  return app.canvas.convertEventToCanvasOffset({ clientX, clientY })
}

/**
 * Insert a workflow's graph into the current graph at the drop position.
 * Mirrors the stock "插入" (insertWorkflow) behaviour.
 */
async function insertWorkflowAt(workflow, clientX, clientY) {
  if (!window.LGraph || !window.LGraphCanvas) {
    toast('无法插入工作流', 'LiteGraph 未初始化')
    return
  }
  try {
    const loaded = await workflow.load()
    const state = JSON.parse(JSON.stringify(loaded.initialState))
    const graph = new LGraph(state)
    const canvasElement = document.createElement('canvas')
    const tempCanvas = new LGraphCanvas(canvasElement, graph, {
      skip_events: true,
      skip_render: true
    })
    tempCanvas.selectItems()
    const oldClipboard = localStorage.getItem('litegrapheditor_clipboard')
    tempCanvas.copyToClipboard()
    app.canvas.pasteFromClipboard({ position: canvasPosAt(clientX, clientY) })
    if (oldClipboard !== null) {
      localStorage.setItem('litegrapheditor_clipboard', oldClipboard)
    }
  } catch (err) {
    toast('插入工作流失败', err)
  }
}

/**
 * Insert a subgraph blueprint node into the current graph at the drop
 * position. Mirrors addNodeOnGraph's blueprint branch.
 */
async function insertBlueprintAt(workflow, clientX, clientY) {
  const canvas = app?.canvas
  if (!canvas || typeof canvas._deserializeItems !== 'function') {
    toast('无法插入节点蓝图', '画布未初始化')
    return
  }
  try {
    const loaded = await workflow.load()
    const state = loaded.initialState
    if (!state) {
      toast('无法插入节点蓝图', '蓝图内容尚未加载')
      return
    }
    const items = {
      nodes: JSON.parse(JSON.stringify(state.nodes ?? [])),
      subgraphs: JSON.parse(JSON.stringify(state.definitions?.subgraphs ?? []))
    }
    const results = canvas._deserializeItems(items, {
      position: canvasPosAt(clientX, clientY)
    })
    const node = results?.nodes?.values().next().value
    if (node) canvas.selectItems([node])
  } catch (err) {
    toast('插入节点蓝图失败', err)
  }
}

function onItemDragEnd(e) {
  const was = ui.drag
  onDragEnd(e)
  if (!was || was.type !== 'item') return
  if (!isOverCanvas(e.clientX, e.clientY)) return
  const w = workflowStore()?.workflows?.find((x) => x.path === was.path)
  if (!w) return
  if (was.kind === 'blueprint') {
    insertBlueprintAt(w, e.clientX, e.clientY)
  } else {
    insertWorkflowAt(w, e.clientX, e.clientY)
  }
}

// Show a valid drop cursor when dragging organizer items over the canvas.
document.addEventListener(
  'dragover',
  (e) => {
    if (ui.drag && isOverCanvas(e.clientX, e.clientY)) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
  },
  true
)

/* ------------------------------------------------------------------ */
/* Backup area                                                         */
/* ------------------------------------------------------------------ */

function backupApiUrl(path) {
  return api.fileURL(path)
}

async function pickBackupDir() {
  try {
    const resp = await fetch(backupApiUrl('/sidebar-organizer/pick-folder'), {
      method: 'POST'
    })
    const data = await resp.json()
    if (data?.ok && data.dir) {
      config.backup.dir = data.dir
      config.backup.lastBackup = ''
      await saveConfig()
      render()
      notify('已设置备份目录', data.dir, 'success')
    } else {
      toast('选择文件夹失败', data?.error ?? '未知错误')
    }
  } catch (err) {
    toast('选择文件夹失败', err)
  }
}

async function setBackupDirManually() {
  const dlg = dialog()
  const dir = dlg
    ? await dlg.prompt({
        title: '备份目录',
        message: '请输入备份文件夹的完整本地路径：',
        defaultValue: config.backup.dir,
        placeholder: '例如 D:\\ComfyUI-备份'
      })
    : prompt('备份目录路径：', config.backup.dir)
  if (!dir || !dir.trim()) return
  config.backup.dir = dir.trim()
  config.backup.lastBackup = ''
  await saveConfig()
  render()
}

async function runBackup(manual = false) {
  const dir = config.backup?.dir
  if (!dir) {
    if (manual) toast('请先选择备份文件夹')
    return
  }
  try {
    const resp = await fetch(backupApiUrl('/sidebar-organizer/backup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, retain: config.backup.retain })
    })
    const data = await resp.json()
    if (data?.ok) {
      config.backup.lastBackup = data.timestamp
      await saveConfig()
      notify(
        `备份完成：${data.counts.workflows} 个工作流、${data.counts.subgraphs} 个蓝图`,
        data.backupDir,
        'success'
      )
      render()
    } else {
      if (resp.status === 404 || resp.status === 405) {
        toast('备份服务未就绪', '请重启 ComfyUI 后重试')
      } else {
        toast('备份失败', data?.error ?? `HTTP ${resp.status}`)
      }
    }
  } catch (err) {
    toast('备份失败', err)
  }
}

// Best-effort backup when the page / app is closing.
window.addEventListener('beforeunload', () => {
  const dir = config?.backup?.dir
  if (!dir || typeof navigator.sendBeacon !== 'function') return
  try {
    navigator.sendBeacon(
      backupApiUrl('/sidebar-organizer/backup'),
      new Blob(
        [JSON.stringify({ dir, retain: config.backup.retain })],
        { type: 'application/json' }
      )
    )
  } catch {
    /* ignore */
  }
})

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const ITEM_ICON = {
  [SECTION_WORKFLOWS]: 'icon-[comfy--workflow]',
  [SECTION_BLUEPRINTS]: 'icon-[comfy--node]'
}

function itemLabel(w) {
  return w.filename || w.fullFilename || w.path.split('/').pop()
}

function renderItem(section, w, folderId = '') {
  const kind = section === SECTION_WORKFLOWS ? 'workflow' : 'blueprint'
  const row = h(
    'div',
    {
      class: 'sorg-item',
      draggable: 'true',
      dataset: { path: w.path, folder: folderId },
      title:
        kind === 'workflow'
          ? '拖到画板可直接插入该工作流；拖入文件夹可归类'
          : '拖到画板可直接插入该节点蓝图；拖入文件夹可归类'
    },
    h('i', { class: 'sorg-item-icon ' + ITEM_ICON[section] }),
    h('span', { class: 'sorg-item-name' }, itemLabel(w)),
    h('button', {
      class: 'sorg-menu-btn',
      text: '⋮',
      title: '更多操作',
      onclick: (ev) => showItemMenu(ev, section, w)
    })
  )
  row.addEventListener('dragstart', (e) =>
    onDragStart(e, { type: 'item', section, path: w.path, kind })
  )
  row.addEventListener('dragend', onItemDragEnd)
  row.addEventListener('dragover', (e) => onItemDragOver(e, row))
  row.addEventListener('dragleave', () => {
    if (ui.dropHint?.el === row) clearDropHint()
  })
  row.addEventListener('drop', (e) => onItemDrop(e, row, section))
  if (section === SECTION_WORKFLOWS) {
    row.addEventListener('dblclick', () => openWorkflow(w.path))
  }
  return row
}

function renderFolder(section, folder) {
  const isOpen = ui.expanded.has(folder.id)
  const body = h(
    'div',
    { class: 'sorg-folder-items' + (isOpen ? '' : ' sorg-collapsed') }
  )
  for (const sub of folder.folders) {
    body.appendChild(renderFolder(section, sub))
  }
  for (const w of folder.items) {
    body.appendChild(renderItem(section, w, folder.id))
  }

  const head = h(
    'div',
    {
      class: 'sorg-folder-row',
      draggable: 'true',
      dataset: { folder: folder.id },
      title:
        '拖入此文件夹可归类；文件夹拖到行上半部可排序、拖到行下半部可移入该文件夹'
    },
    h('i', {
      class:
        'sorg-chevron icon-[lucide--chevron-right]' +
        (isOpen ? ' sorg-chevron-open' : '')
    }),
    h('i', { class: 'sorg-folder-icon icon-[lucide--folder]' }),
    h('span', { class: 'sorg-folder-name' }, folder.name),
    h('span', { class: 'sorg-count' }, String(countItemsRecursive(folder))),
    h('button', {
      class: 'sorg-menu-btn',
      text: '⋮',
      title: '文件夹操作',
      onclick: (ev) => showFolderMenu(ev, section, folder)
    })
  )
  head.addEventListener('click', () => {
    if (ui.expanded.has(folder.id)) ui.expanded.delete(folder.id)
    else ui.expanded.add(folder.id)
    saveExpandedState()
    render()
  })
  head.addEventListener('dragstart', (e) =>
    onDragStart(e, { type: 'folder', section, folderId: folder.id })
  )
  head.addEventListener('dragend', onDragEnd)
  head.addEventListener('dragover', (e) => onFolderDragOver(e, head))
  head.addEventListener('dragleave', () => {
    if (ui.dropHint?.el === head) clearDropHint()
  })
  head.addEventListener('drop', (e) => onFolderDrop(e, head, section))

  return h(
    'div',
    { class: 'sorg-folder', dataset: { folder: folder.id } },
    head,
    body
  )
}

function renderRootGroup(section, root) {
  const head = h(
    'div',
    { class: 'sorg-root-head', title: '拖拽到此处可移出文件夹' },
    h('i', { class: 'sorg-root-icon icon-[lucide--box]' }),
    h('span', { class: 'sorg-root-label' }, '未分类'),
    h('span', { class: 'sorg-count' }, String(root.length))
  )
  const body = h('div', { class: 'sorg-root-items' })
  for (const w of root) body.appendChild(renderItem(section, w, ''))

  head.addEventListener('dragover', (e) => onRootDragOver(e, head))
  head.addEventListener('dragleave', () => {
    if (ui.dropHint?.el === head) clearDropHint()
  })
  head.addEventListener('drop', (e) => onRootDrop(e, head, section))
  body.addEventListener('dragover', (e) => onRootDragOver(e, body))
  body.addEventListener('dragleave', () => {
    if (ui.dropHint?.el === body) clearDropHint()
  })
  body.addEventListener('drop', (e) => onRootDrop(e, body, section))

  return h('div', { class: 'sorg-root-group' }, head, body)
}

function renderSection(section) {
  const model = buildModel(section)
  const body = h('div', { class: 'sorg-section' })
  for (const folder of model.folders) body.appendChild(renderFolder(section, folder))
  body.appendChild(renderRootGroup(section, model.root))

  const head = h(
    'div',
    { class: 'sorg-section-head' },
    h('span', { class: 'sorg-section-title' }, SECTION_TITLES[section]),
    h('span', { class: 'sorg-count' }, String(getSectionItems(section).length)),
    h('button', {
      class: 'sorg-add-btn',
      text: '＋',
      title: '新建文件夹',
      onclick: () => createFolder(section)
    })
  )

  return h('div', { class: 'sorg-section-wrap' }, head, body)
}

function render() {
  closeMenu()
  clearDropHint()
  if (!ui.root) return

  // Guard against the stock refresh button (or anything else) having removed
  // the blueprint entries from the workflow store.
  ensureBlueprintsAttached()

  ui.root.replaceChildren()

  if (!workflowStore()) {
    ui.root.appendChild(
      h('div', { class: 'sorg-empty' }, '正在初始化…如果一直停留在此，请刷新页面。')
    )
    return
  }

  const header = h(
    'div',
    { class: 'sorg-header' },
    h('span', { class: 'sorg-header-title' }, '侧边栏整理器'),
    h('button', {
      class: 'sorg-refresh-btn',
      text: '↻',
      title: '刷新列表',
      onclick: async () => {
        const store = workflowStore()
        // Capture blueprints before the sync: syncWorkflows() re-syncs the
        // workflows directory and, as a side effect, removes every blueprint
        // entry from the workflow store. Restore them afterwards.
        const blueprints = (store.workflows ?? []).filter(
          (w) => w.path.startsWith('subgraphs/') && w.isPersisted
        )
        try {
          await store.syncWorkflows()
        } catch (err) {
          toast('刷新失败', err)
        }
        for (const bp of blueprints) {
          if (!store.workflows.some((w) => w.path === bp.path)) {
            try {
              store.attachWorkflow(bp)
            } catch (err) {
              console.error(
                `[${EXTENSION_NAME}] Failed to re-attach blueprint`,
                err
              )
            }
          }
        }
        ensureBlueprintsAttached()
        render()
      }
    })
  )

  const scroll = h('div', { class: 'sorg-scroll' })
  scroll.appendChild(renderSection(SECTION_WORKFLOWS))
  scroll.appendChild(renderSection(SECTION_BLUEPRINTS))
  scroll.appendChild(renderBackupSection())

  ui.root.appendChild(header)
  ui.root.appendChild(scroll)

  // Clean up any drag state left behind by a cancelled drag.
  ui.drag = null
}

function renderBackupSection() {
  const bk = config.backup
  const head = h(
    'div',
    { class: 'sorg-backup-head' },
    h('span', { class: 'sorg-section-title' }, '备份区'),
    h('span', { class: 'sorg-count' }, bk.dir ? '已启用' : '未设置')
  )
  const dirRow = h(
    'div',
    { class: 'sorg-backup-dir' },
    h('span', { class: 'sorg-backup-dir-label' }, '备份目录：'),
    h(
      'span',
      { class: 'sorg-backup-dir-path', title: bk.dir || '' },
      bk.dir || '（未选择）'
    )
  )
  const btns = h(
    'div',
    { class: 'sorg-backup-btns' },
    h('button', {
      class: 'sorg-btn',
      text: '选择文件夹…',
      title: '弹出系统目录选择框',
      onclick: () => pickBackupDir()
    }),
    h('button', {
      class: 'sorg-btn',
      text: '手动输入…',
      title: '直接输入完整路径',
      onclick: () => setBackupDirManually()
    }),
    h('button', {
      class: 'sorg-btn sorg-btn-primary',
      text: '立即备份',
      onclick: () => runBackup(true)
    })
  )
  const opts = h(
    'div',
    { class: 'sorg-backup-opts' },
    h('span', null, '保留最近 '),
    h('input', {
      class: 'sorg-retain-input',
      type: 'number',
      min: '1',
      value: String(bk.retain),
      title: '超出数量的旧快照会被自动清理',
      onchange: (e) => {
        const v = parseInt(e.target.value, 10)
        if (Number.isFinite(v) && v >= 1) {
          config.backup.retain = v
          saveConfig()
        }
      }
    }),
    h('span', null, ' 份快照')
  )
  const note = h(
    'div',
    { class: 'sorg-backup-note' },
    '每次加载 / 退出 ComfyUI 时自动备份工作流与节点蓝图'
  )
  const last = h(
    'div',
    { class: 'sorg-backup-last' },
    '上次备份：' + (bk.lastBackup || '—')
  )
  return h('div', { class: 'sorg-backup' }, head, dirRow, btns, opts, note, last)
}

/* ------------------------------------------------------------------ */
/* Tab registration                                                    */
/* ------------------------------------------------------------------ */

let tabRegistered = false

function registerTab() {
  if (tabRegistered) return
  injectStyles()
  if (!app?.extensionManager?.registerSidebarTab) {
    // The workspace store may not be mounted yet; retry a few times.
    if (!window.__sorgRetryCount) window.__sorgRetryCount = 0
    if (window.__sorgRetryCount++ < 50) {
      setTimeout(registerTab, 200)
    } else {
      console.error(`[${EXTENSION_NAME}] Failed to register sidebar tab`)
    }
    return
  }
  tabRegistered = true
  loadExpandedState()
  loadConfig().then(() => {
    app.extensionManager.registerSidebarTab({
      id: TAB_ID,
      icon: 'icon-[lucide--folder]',
      title: '侧边栏整理器',
      tooltip: '为工作流和节点蓝图创建文件夹、拖拽分类与排序',
      label: '整理',
      type: 'custom',
      render(el) {
        ui.root = el
        el.classList.add('sorg-root')
        render()
      },
      destroy() {
        closeMenu()
        ui.root = null
      }
    })
    // "每次加载"自动备份：配置了目录就在页面加载后备份一次。
    if (config.backup?.dir) runBackup(false)
  })
}

app.registerExtension({
  name: EXTENSION_NAME,
  async setup() {
    registerTab()
  }
})
