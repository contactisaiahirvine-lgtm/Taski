// Task Manager Application Logic

let zones = [];
let tasks = [];
let draggedTask = null;
let draggedZone = null;
let editingColorZoneId = null;

const colorOptions = ['red', 'orange', 'green', 'blue', 'purple', 'gray'];

// Initialize the application
async function init() {
  await loadData();
  render();
  setupEventListeners();
}

// Load data from electron-store
async function loadData() {
  zones = await window.electronAPI.store.get('zones') || [];
  tasks = await window.electronAPI.store.get('tasks') || [];

  // Initialize default zones if none exist
  if (zones.length === 0) {
    zones = [
      { id: generateId(), title: 'Urgent', order: 0, color: 'red' },
      { id: generateId(), title: 'Middling', order: 1, color: 'orange' },
      { id: generateId(), title: 'Not Urgent', order: 2, color: 'green' }
    ];
    await saveZones();
  }
}

// Save functions
async function saveZones() {
  await window.electronAPI.store.set('zones', zones);
}

async function saveTasks() {
  await window.electronAPI.store.set('tasks', tasks);
}

// Generate unique IDs
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Event Listeners
function setupEventListeners() {
  // Add task form
  document.getElementById('add-task-form').addEventListener('submit', handleAddTask);

  // Add zone form
  document.getElementById('add-zone-form').addEventListener('submit', handleAddZone);

  // Close modal on background click
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
      closeModal();
    }
  });

  // Click outside to close color picker
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.color-picker-container') && !e.target.closest('.settings-button')) {
      editingColorZoneId = null;
      render();
    }
  });
}

// Task Management
async function handleAddTask(e) {
  e.preventDefault();
  const input = document.getElementById('new-task-input');
  const text = input.value.trim();

  if (!text) return;

  const firstZone = zones[0];
  if (!firstZone) {
    alert('Please create a zone first!');
    return;
  }

  // Find tasks in the first zone and add to top
  const tasksInZone = tasks.filter(t => t.zoneId === firstZone.id);
  const newOrder = tasksInZone.length > 0
    ? Math.min(...tasksInZone.map(t => t.order)) - 1
    : 0;

  tasks.push({
    id: generateId(),
    text: text,
    zoneId: firstZone.id,
    order: newOrder
  });

  await saveTasks();
  input.value = '';
  render();
}

async function handleAddZone(e) {
  e.preventDefault();
  const input = document.getElementById('new-zone-input');
  const title = input.value.trim();

  if (!title) return;

  const newOrder = zones.length > 0
    ? Math.max(...zones.map(z => z.order)) + 1
    : 0;

  zones.push({
    id: generateId(),
    title: title,
    order: newOrder,
    color: 'gray'
  });

  await saveZones();
  input.value = '';
  render();
}

async function completeTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  showModal(
    `Are you sure you want to complete this task?\n\n"${task.text}"`,
    async () => {
      tasks = tasks.filter(t => t.id !== taskId);
      await saveTasks();
      render();
    }
  );
}

async function removeZone(zoneId) {
  const zone = zones.find(z => z.id === zoneId);
  if (!zone) return;

  showModal(
    `Are you sure you want to remove this zone?\n\n"${zone.title}"\n\nAll tasks within it will also be deleted.`,
    async () => {
      tasks = tasks.filter(t => t.zoneId !== zoneId);
      zones = zones.filter(z => z.id !== zoneId);
      await saveTasks();
      await saveZones();
      render();
    }
  );
}

async function updateTaskText(taskId, newText) {
  const task = tasks.find(t => t.id === taskId);
  const trimmed = newText.trim();

  if (task && trimmed && task.text !== trimmed) {
    task.text = trimmed;
    await saveTasks();
  }
}

async function updateZoneTitle(zoneId, newTitle) {
  const zone = zones.find(z => z.id === zoneId);
  const trimmed = newTitle.trim();

  if (zone && trimmed && zone.title !== trimmed) {
    zone.title = trimmed;
    await saveZones();
  }
}

async function updateZoneColor(zoneId, newColor) {
  const zone = zones.find(z => z.id === zoneId);

  if (zone && colorOptions.includes(newColor)) {
    zone.color = newColor;
    await saveZones();
    editingColorZoneId = null;
    render();
  }
}

// Drag and Drop
function onTaskDragStart(e, taskId) {
  draggedTask = taskId;
  e.dataTransfer.effectAllowed = 'move';
  e.target.classList.add('opacity-30');
}

function onTaskDragEnd(e) {
  e.target.classList.remove('opacity-30');
  draggedTask = null;
}

function onZoneDragOver(e) {
  e.preventDefault();
}

async function onZoneDrop(e, targetZoneId) {
  e.preventDefault();

  if (!draggedTask) return;

  const task = tasks.find(t => t.id === draggedTask);
  if (!task || task.zoneId === targetZoneId) return;

  // Move to top of new zone
  const tasksInTargetZone = tasks.filter(t => t.zoneId === targetZoneId);
  const newOrder = tasksInTargetZone.length > 0
    ? Math.min(...tasksInTargetZone.map(t => t.order)) - 1
    : 0;

  task.zoneId = targetZoneId;
  task.order = newOrder;

  await saveTasks();
  render();
}

function onZoneDragStart(e, zoneId) {
  draggedZone = zoneId;
  e.dataTransfer.effectAllowed = 'move';
}

function onZoneDragEnd(e) {
  draggedZone = null;
}

async function onZoneDropReorder(e, targetZoneId) {
  e.preventDefault();

  if (!draggedZone || draggedZone === targetZoneId) return;

  const sourceZone = zones.find(z => z.id === draggedZone);
  const targetZone = zones.find(z => z.id === targetZoneId);

  if (!sourceZone || !targetZone) return;

  // Swap orders
  const tempOrder = sourceZone.order;
  sourceZone.order = targetZone.order;
  targetZone.order = tempOrder;

  await saveZones();
  render();
}

// Modal
function showModal(message, onConfirm) {
  const modal = document.getElementById('modal-overlay');
  const messageEl = document.getElementById('modal-message');
  const confirmBtn = document.getElementById('modal-confirm');
  const cancelBtn = document.getElementById('modal-cancel');

  messageEl.textContent = message;
  modal.classList.remove('hidden');

  // Remove old listeners
  const newConfirmBtn = confirmBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  document.getElementById('modal-confirm').addEventListener('click', () => {
    onConfirm();
    closeModal();
  });

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Render
function render() {
  // Sort zones by order
  zones.sort((a, b) => a.order - b.order);

  // Sort tasks by order
  tasks.sort((a, b) => a.order - b.order);

  const container = document.getElementById('zones-container');
  container.innerHTML = '';

  zones.forEach(zone => {
    const zoneEl = createZoneElement(zone);
    container.appendChild(zoneEl);
  });
}

function createZoneElement(zone) {
  const zoneTasks = tasks.filter(t => t.zoneId === zone.id);
  const colorClass = `bg-${zone.color}-100`;

  const zoneDiv = document.createElement('div');
  zoneDiv.className = 'zone-card bg-white rounded-lg shadow-lg';
  zoneDiv.setAttribute('data-zone-id', zone.id);

  // Header
  const header = document.createElement('div');
  header.className = 'zone-header flex justify-between items-center p-3 border-b border-gray-200 cursor-grab active:cursor-grabbing';
  header.draggable = true;

  header.addEventListener('dragstart', (e) => onZoneDragStart(e, zone.id));
  header.addEventListener('dragend', onZoneDragEnd);
  header.addEventListener('dragover', onZoneDragOver);
  header.addEventListener('drop', (e) => onZoneDropReorder(e, zone.id));

  const title = document.createElement('span');
  title.className = 'zone-title font-semibold text-lg flex-1 mr-2 px-1 rounded hover:bg-gray-200 focus:bg-gray-200 focus:outline-none';
  title.contentEditable = true;
  title.textContent = zone.title;
  title.addEventListener('blur', (e) => {
    updateZoneTitle(zone.id, e.target.textContent);
  });

  const controls = document.createElement('div');
  controls.className = 'relative flex items-center space-x-2 color-picker-container';

  // Settings button
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors settings-button';
  settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`;
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    editingColorZoneId = editingColorZoneId === zone.id ? null : zone.id;
    render();
  });

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'p-1 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-700 transition-colors';
  removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
  removeBtn.addEventListener('click', () => removeZone(zone.id));

  controls.appendChild(settingsBtn);
  controls.appendChild(removeBtn);

  // Color picker
  if (editingColorZoneId === zone.id) {
    const picker = document.createElement('div');
    picker.className = 'absolute top-full right-0 z-10 mt-2 p-2 bg-white shadow-xl rounded-md border border-gray-200 flex space-x-2';

    colorOptions.forEach(color => {
      const colorBtn = document.createElement('button');
      colorBtn.className = `w-6 h-6 rounded-full border border-gray-300 bg-${color}-500 transform hover:scale-110 transition-transform`;
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateZoneColor(zone.id, color);
      });
      picker.appendChild(colorBtn);
    });

    controls.appendChild(picker);
  }

  header.appendChild(title);
  header.appendChild(controls);

  // Task list
  const taskList = document.createElement('div');
  taskList.className = `task-list flex-1 p-3 space-y-3 ${colorClass} overflow-y-auto max-h-96`;
  taskList.addEventListener('dragover', onZoneDragOver);
  taskList.addEventListener('drop', (e) => onZoneDrop(e, zone.id));

  if (zoneTasks.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'text-gray-500 text-center p-6 italic';
    emptyMsg.textContent = 'No tasks in this section.';
    taskList.appendChild(emptyMsg);
  } else {
    zoneTasks.forEach(task => {
      const taskEl = createTaskElement(task);
      taskList.appendChild(taskEl);
    });
  }

  zoneDiv.appendChild(header);
  zoneDiv.appendChild(taskList);

  return zoneDiv;
}

function createTaskElement(task) {
  const taskDiv = document.createElement('div');
  taskDiv.className = 'task-card p-3 bg-white rounded-md shadow-md flex items-center justify-between cursor-grab active:cursor-grabbing transition-opacity';
  taskDiv.draggable = true;
  taskDiv.setAttribute('data-task-id', task.id);

  taskDiv.addEventListener('dragstart', (e) => onTaskDragStart(e, task.id));
  taskDiv.addEventListener('dragend', onTaskDragEnd);

  const text = document.createElement('span');
  text.className = 'flex-1 mr-2 px-1 rounded hover:bg-gray-100 focus:bg-gray-100 focus:outline-none';
  text.contentEditable = true;
  text.textContent = task.text;
  text.addEventListener('blur', (e) => {
    updateTaskText(task.id, e.target.textContent);
  });

  const completeBtn = document.createElement('button');
  completeBtn.className = 'p-1 rounded-full text-green-600 hover:bg-green-100 hover:text-green-800 transition-colors';
  completeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
  completeBtn.addEventListener('click', () => completeTask(task.id));

  taskDiv.appendChild(text);
  taskDiv.appendChild(completeBtn);

  return taskDiv;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
