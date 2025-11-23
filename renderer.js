// Task Manager Application Logic

let zones = [];
let tasks = [];
let draggedTask = null;
let draggedZone = null;
let editingColorZoneId = null;
let editingAdvancedZoneId = null;
let selectedTasks = new Set();

const colorOptions = ['red', 'orange', 'green', 'blue', 'purple', 'gray'];

// Initialize the application
async function init() {
  await loadData();
  render();
  setupEventListeners();
}

// Load data from electron-store
async function loadData() {
  try {
    zones = await window.electronAPI.store.get('zones') || [];
    tasks = await window.electronAPI.store.get('tasks') || [];

    console.log('Loaded zones from storage:', zones.length);

    // Initialize default zones if none exist
    if (zones.length === 0) {
      console.log('No zones found, creating defaults...');
      zones = [
        { id: generateId(), title: 'Urgent', order: 0, color: 'red', isDefault: true, hidden: false, customTag: '-u' },
        { id: generateId(), title: 'Middling', order: 1, color: 'orange', isDefault: true, hidden: false, customTag: '-m' },
        { id: generateId(), title: 'Not Urgent', order: 2, color: 'green', isDefault: true, hidden: false, customTag: '-n' }
      ];
      console.log('Created default zones:', zones.length);
      await saveZones();
      console.log('Saved default zones');
    } else {
      // Migrate existing zones to have new properties
      console.log('Migrating existing zones...');
      zones = zones.map(zone => {
        // Check if this is one of the default zones by title
        const isDefaultZone = ['Urgent', 'Middling', 'Not Urgent'].includes(zone.title);

        return {
          ...zone,
          // If this is a default zone by title, FORCE isDefault to true (override any old value)
          isDefault: isDefaultZone ? true : (zone.isDefault || false),
          hidden: zone.hidden !== undefined ? zone.hidden : false,
          customTag: zone.customTag || (zone.title === 'Urgent' ? '-u' : zone.title === 'Middling' ? '-m' : zone.title === 'Not Urgent' ? '-n' : '')
        };
      });

      // Log the zones for debugging
      console.log('Zones after migration:', zones.map(z => ({ title: z.title, isDefault: z.isDefault, hidden: z.hidden, customTag: z.customTag })));

      await saveZones();
      console.log('Saved migrated zones');
    }
  } catch (error) {
    console.error('Error loading data:', error);
    // Fallback to default zones if there's an error
    zones = [
      { id: generateId(), title: 'Urgent', order: 0, color: 'red', isDefault: true, hidden: false, customTag: '-u' },
      { id: generateId(), title: 'Middling', order: 1, color: 'orange', isDefault: true, hidden: false, customTag: '-m' },
      { id: generateId(), title: 'Not Urgent', order: 2, color: 'green', isDefault: true, hidden: false, customTag: '-n' }
    ];
    tasks = [];
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

  // Keyboard support for modal and task deletion
  document.addEventListener('keydown', async (e) => {
    const modal = document.getElementById('modal-overlay');
    if (!modal.classList.contains('hidden')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('modal-confirm').click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    } else {
      // Ctrl+Shift+R to reset data (clear store and reload)
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        console.log('Resetting data store...');
        await window.electronAPI.store.delete('zones');
        await window.electronAPI.store.delete('tasks');
        console.log('Store cleared. Reloading...');
        location.reload();
      }
      // Delete key for completing selected tasks
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTasks.size > 0) {
        // Only if not focused on an input or contenteditable
        if (!document.activeElement.matches('input, [contenteditable="true"]')) {
          e.preventDefault();
          completeSelectedTasks();
        }
      }
    }
  });

  // Click outside to close color picker and advanced settings
  document.addEventListener('click', (e) => {
    // Don't trigger re-render if clicking on unhide zone dropdown
    if (e.target.closest('#unhide-zone-container')) {
      return;
    }

    if (!e.target.closest('.color-picker-container') && !e.target.closest('.settings-button')) {
      editingColorZoneId = null;
      render();
    }
    if (!e.target.closest('.advanced-settings-modal') && !e.target.closest('.advanced-settings-button')) {
      editingAdvancedZoneId = null;
      render();
    }
  });
}

// Task Management
async function handleAddTask(e) {
  e.preventDefault();
  const input = document.getElementById('new-task-input');
  let text = input.value.trim();

  if (!text) return;

  // Parse tag from text (look for -x at the end, with optional space before)
  let targetZone = null;
  const tagMatch = text.match(/\s*(-[^\s]+)\s*$/);

  if (tagMatch) {
    const tag = tagMatch[1];
    // Remove tag from text
    text = text.replace(/\s*-[^\s]+\s*$/, '').trim();

    // Find zone with matching custom tag (search all zones, including hidden)
    // Check for zones that have a customTag set and it matches
    targetZone = zones.find(z => {
      const zoneTag = z.customTag?.trim();
      return zoneTag && zoneTag.length > 0 && zoneTag === tag;
    });
  }

  // If no matching zone found, use first visible zone
  if (!targetZone) {
    const visibleZones = zones.filter(z => !z.hidden);
    if (visibleZones.length === 0) {
      alert('Please create or unhide at least one zone first!');
      return;
    }
    targetZone = visibleZones[0];
  }

  // Find tasks in the target zone and add to top
  const tasksInZone = tasks.filter(t => t.zoneId === targetZone.id);
  const newOrder = tasksInZone.length > 0
    ? Math.min(...tasksInZone.map(t => t.order)) - 1
    : 0;

  tasks.push({
    id: generateId(),
    text: text,
    zoneId: targetZone.id,
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
    color: 'gray',
    isDefault: false,
    hidden: false,
    customTag: ''
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
      const wasSelected = selectedTasks.has(taskId);

      // Find the next task in the same zone before deleting (only if this task was selected)
      let nextTask = null;
      if (wasSelected) {
        const zoneTasksList = tasks.filter(t => t.zoneId === task.zoneId).sort((a, b) => a.order - b.order);
        const currentIndex = zoneTasksList.findIndex(t => t.id === taskId);

        if (currentIndex >= 0 && currentIndex < zoneTasksList.length - 1) {
          // Select next task in the zone
          nextTask = zoneTasksList[currentIndex + 1];
        } else if (currentIndex > 0) {
          // If it's the last task, select the previous one
          nextTask = zoneTasksList[currentIndex - 1];
        }
      }

      // Remove the task and update selection
      tasks = tasks.filter(t => t.id !== taskId);
      selectedTasks.delete(taskId);

      // Transfer selection to next task if the completed task was selected
      if (nextTask) {
        selectedTasks.add(nextTask.id);
      }

      await saveTasks();
      render();
    }
  );
}

async function completeSelectedTasks() {
  if (selectedTasks.size === 0) return;

  const taskCount = selectedTasks.size;
  showModal(
    `Are you sure you want to complete ${taskCount} selected task${taskCount > 1 ? 's' : ''}?`,
    async () => {
      // Find the next task in visual order before deleting
      let nextTask = null;

      // Get all visible zones sorted by order
      const visibleZones = zones.filter(z => !z.hidden).sort((a, b) => a.order - b.order);

      // Build a flat list of all tasks in visual order
      const allTasksInOrder = [];
      visibleZones.forEach(zone => {
        const zoneTasks = tasks.filter(t => t.zoneId === zone.id).sort((a, b) => a.order - b.order);
        allTasksInOrder.push(...zoneTasks);
      });

      // Find the selected task (assuming single selection)
      const selectedTaskId = Array.from(selectedTasks)[0];
      const currentIndex = allTasksInOrder.findIndex(t => t.id === selectedTaskId);

      if (currentIndex >= 0) {
        // Try to get the next task
        if (currentIndex < allTasksInOrder.length - 1) {
          nextTask = allTasksInOrder[currentIndex + 1];
        } else if (currentIndex > 0) {
          // If it's the last task, select the previous one
          nextTask = allTasksInOrder[currentIndex - 1];
        }
      }

      // Delete the selected tasks
      tasks = tasks.filter(t => !selectedTasks.has(t.id));
      selectedTasks.clear();

      // Select the next task if one was found
      if (nextTask) {
        selectedTasks.add(nextTask.id);
      }

      await saveTasks();
      render();
    }
  );
}

function toggleTaskSelection(taskId) {
  if (selectedTasks.has(taskId)) {
    // Clicking on already selected task - deselect it
    selectedTasks.delete(taskId);
  } else {
    // Clicking on a different task - clear all and select only this one
    selectedTasks.clear();
    selectedTasks.add(taskId);
  }
  render();
}

async function removeZone(zoneId) {
  const zone = zones.find(z => z.id === zoneId);
  if (!zone) return;

  // Prevent deletion of default zones - check both flag AND title as backup
  const isDefaultZone = zone.isDefault === true || ['Urgent', 'Middling', 'Not Urgent'].includes(zone.title);

  console.log(`Attempting to remove zone "${zone.title}". isDefault=${zone.isDefault}, isDefaultZone=${isDefaultZone}`);

  if (isDefaultZone) {
    alert('Default zones (Urgent, Middling, Not Urgent) cannot be deleted. You can hide them instead.');
    return;
  }

  showModal(
    `Are you sure you want to remove this zone?\n\n"${zone.title}"\n\nAll tasks within it will also be deleted.`,
    async () => {
      // Triple-check before deleting - check both flag AND title
      const stillDefaultZone = zone.isDefault === true || ['Urgent', 'Middling', 'Not Urgent'].includes(zone.title);

      if (stillDefaultZone) {
        alert('Cannot delete default zones!');
        console.error('Attempted to delete default zone in modal callback!');
        return;
      }

      tasks = tasks.filter(t => t.zoneId !== zoneId);
      zones = zones.filter(z => z.id !== zoneId);
      await saveTasks();
      await saveZones();
      render();
    }
  );
}

async function toggleZoneVisibility(zoneId) {
  const zone = zones.find(z => z.id === zoneId);
  if (!zone) return;

  zone.hidden = !zone.hidden;

  // Tasks stay in the zone, they just get hidden with it
  await saveZones();
  render();
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
    // Prevent renaming default zones
    if (zone.isDefault === true) {
      alert('Cannot rename default zones (Urgent, Middling, Not Urgent).');
      render(); // Re-render to reset the title
      return;
    }

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

async function updateZoneCustomTag(zoneId, newTag) {
  const zone = zones.find(z => z.id === zoneId);
  const trimmed = newTag.trim();

  // Validate tag format: must start with - and have no spaces
  if (trimmed && !trimmed.match(/^-[^\s]+$/)) {
    alert('Custom tag must be in the format "-x" where x is any non-spaced string.');
    return false;
  }

  if (zone) {
    zone.customTag = trimmed;
    await saveZones();
    return true;
  }
  return false;
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
  console.log('=== RENDER CALLED ===');
  console.log('Total zones:', zones.length);
  console.log('Zones state:', zones.map(z => ({ title: z.title, hidden: z.hidden, isDefault: z.isDefault })));

  // Sort zones by order
  zones.sort((a, b) => a.order - b.order);

  // Sort tasks by order
  tasks.sort((a, b) => a.order - b.order);

  const container = document.getElementById('zones-container');
  container.innerHTML = '';

  // Only render visible zones
  const visibleZones = zones.filter(z => !z.hidden);
  console.log('Visible zones:', visibleZones.length);
  console.log('Hidden zones:', zones.filter(z => z.hidden).map(z => z.title));

  visibleZones.forEach(zone => {
    const zoneEl = createZoneElement(zone);
    container.appendChild(zoneEl);
  });

  // Render unhide zone dropdown
  renderUnhideZoneDropdown();
}

function renderUnhideZoneDropdown() {
  const container = document.getElementById('unhide-zone-container');
  if (!container) return;

  const hiddenZones = zones.filter(z => z.hidden);

  if (hiddenZones.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';

  const label = document.createElement('label');
  label.className = 'block text-sm text-gray-700 mb-1';
  label.textContent = 'Unhide Zone:';
  container.appendChild(label);

  const select = document.createElement('select');
  select.className = 'control-input w-full';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Select a zone to unhide --';
  select.appendChild(defaultOption);

  hiddenZones.forEach(zone => {
    const option = document.createElement('option');
    option.value = zone.id;
    option.textContent = zone.title;
    select.appendChild(option);
  });

  select.addEventListener('change', async (e) => {
    if (e.target.value) {
      await toggleZoneVisibility(e.target.value);
      e.target.value = ''; // Reset selection
    }
  });

  container.appendChild(select);
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
  const isDefaultZone = zone.isDefault === true || ['Urgent', 'Middling', 'Not Urgent'].includes(zone.title);

  // Make default zones' titles non-editable
  if (isDefaultZone) {
    title.className = 'zone-title font-semibold text-lg flex-1 mr-2 px-1';
    title.contentEditable = false;
  } else {
    title.className = 'zone-title font-semibold text-lg flex-1 mr-2 px-1 rounded hover:bg-gray-200 focus:bg-gray-200 focus:outline-none';
    title.style.userSelect = 'text';
    title.contentEditable = true;
    title.addEventListener('blur', (e) => {
      updateZoneTitle(zone.id, e.target.textContent);
    });
    title.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  title.textContent = zone.title;

  const controls = document.createElement('div');
  controls.className = 'relative flex items-center space-x-2 color-picker-container';

  // Hide/Show button
  const hideBtn = document.createElement('button');
  hideBtn.className = 'p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors';
  hideBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>`;
  hideBtn.title = 'Hide zone';
  hideBtn.addEventListener('click', () => toggleZoneVisibility(zone.id));

  // Settings button
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors settings-button';
  settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`;
  settingsBtn.title = 'Settings';
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    editingColorZoneId = editingColorZoneId === zone.id ? null : zone.id;
    render();
  });

  // Remove button - reuse isDefaultZone check from above
  const removeBtn = document.createElement('button');

  if (isDefaultZone) {
    removeBtn.className = 'p-1 rounded-full text-gray-400 cursor-not-allowed transition-colors';
    removeBtn.disabled = true;
  } else {
    removeBtn.className = 'p-1 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-700 transition-colors';
  }
  removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
  removeBtn.title = isDefaultZone ? 'Cannot delete default zones' : 'Delete zone';
  if (!isDefaultZone) {
    removeBtn.addEventListener('click', () => removeZone(zone.id));
  }

  controls.appendChild(hideBtn);
  controls.appendChild(settingsBtn);
  controls.appendChild(removeBtn);

  // Color picker and Advanced Settings
  if (editingColorZoneId === zone.id) {
    const picker = document.createElement('div');
    picker.className = 'absolute top-full right-0 mt-2 p-3 bg-white shadow-xl rounded-md border border-gray-200 flex flex-col gap-3';
    picker.style.zIndex = '1000';

    // Color options
    const colorRow = document.createElement('div');
    colorRow.className = 'flex space-x-2';
    colorOptions.forEach(color => {
      const colorBtn = document.createElement('button');
      colorBtn.className = `w-6 h-6 rounded-full border-2 ${zone.color === color ? 'border-gray-800' : 'border-gray-300'} bg-${color}-500 transform hover:scale-110 transition-transform`;
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateZoneColor(zone.id, color);
      });
      colorRow.appendChild(colorBtn);
    });
    picker.appendChild(colorRow);

    // Advanced Settings button
    const advancedBtn = document.createElement('button');
    advancedBtn.className = 'text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-2 py-1 rounded advanced-settings-button';
    advancedBtn.textContent = 'Advanced Settings';
    advancedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      editingAdvancedZoneId = editingAdvancedZoneId === zone.id ? null : zone.id;
      editingColorZoneId = null;
      render();
    });
    picker.appendChild(advancedBtn);

    controls.appendChild(picker);
  }

  // Advanced Settings Modal
  if (editingAdvancedZoneId === zone.id) {
    const advancedModal = document.createElement('div');
    advancedModal.className = 'absolute top-full right-0 mt-2 p-4 bg-white shadow-xl rounded-md border border-gray-200 w-64 advanced-settings-modal';
    advancedModal.style.zIndex = '1000';

    const modalTitle = document.createElement('h4');
    modalTitle.className = 'font-semibold mb-3 text-gray-800';
    modalTitle.textContent = 'Advanced Settings';
    advancedModal.appendChild(modalTitle);

    // Custom Tag Input
    const tagLabel = document.createElement('label');
    tagLabel.className = 'block text-sm text-gray-700 mb-1';
    tagLabel.textContent = 'Custom Tag (format: -x):';
    advancedModal.appendChild(tagLabel);

    const tagInput = document.createElement('input');
    tagInput.type = 'text';
    tagInput.className = 'w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2';
    tagInput.value = zone.customTag || '';
    tagInput.placeholder = '-example';
    advancedModal.appendChild(tagInput);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'w-full btn btn-primary text-sm py-1';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const success = await updateZoneCustomTag(zone.id, tagInput.value);
      if (success) {
        editingAdvancedZoneId = null;
        render();
      }
    });
    advancedModal.appendChild(saveBtn);

    controls.appendChild(advancedModal);
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
  const isSelected = selectedTasks.has(task.id);

  const taskDiv = document.createElement('div');
  taskDiv.className = `task-card p-3 bg-white rounded-md shadow-md flex items-center justify-between cursor-grab active:cursor-grabbing transition-opacity ${isSelected ? 'ring-2 ring-blue-500' : ''}`;
  taskDiv.draggable = true;
  taskDiv.setAttribute('data-task-id', task.id);

  taskDiv.addEventListener('dragstart', (e) => onTaskDragStart(e, task.id));
  taskDiv.addEventListener('dragend', onTaskDragEnd);

  // Text wrapper to take up remaining space
  const textWrapper = document.createElement('div');
  textWrapper.className = 'flex-1 min-w-0';

  // Click on task card to select (but not on text or button)
  taskDiv.addEventListener('click', (e) => {
    // Only toggle selection if clicking on the card itself, textWrapper, or empty areas
    if (e.target === taskDiv || e.target === textWrapper || e.target.classList.contains('task-card')) {
      toggleTaskSelection(task.id);
    }
  });

  const text = document.createElement('span');
  text.className = 'px-1 rounded hover:bg-gray-100 focus:bg-gray-100 focus:outline-none';
  text.style.display = 'inline-block';
  text.contentEditable = true;
  text.textContent = task.text;
  text.addEventListener('blur', (e) => {
    updateTaskText(task.id, e.target.textContent);
  });
  text.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent selection when clicking to edit text
  });
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent newline
      e.target.blur(); // Exit editing mode
    }
  });

  textWrapper.appendChild(text);

  const completeBtn = document.createElement('button');
  completeBtn.className = 'p-1 rounded-full text-green-600 hover:bg-green-100 hover:text-green-800 transition-colors ml-2 flex-shrink-0';
  completeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
  completeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent selection when clicking complete button
    completeTask(task.id);
  });

  taskDiv.appendChild(textWrapper);
  taskDiv.appendChild(completeBtn);

  return taskDiv;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
