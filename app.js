(() => {
  'use strict';

  const STORAGE_KEY = 'order-desk.orders.v1';
  const ACTIVITY_KEY = 'order-desk.activity.v1';
  const CUSTOMER_KEY = 'order-desk.customers.v1';
  const INVENTORY_KEY = 'order-desk.inventory.v1';
  const STATUSES = ['Pending', 'In Progress', 'Waiting for Supplier', 'Requires Attention', 'Completed', 'Cancelled'];
  const STALE_DAYS = 7;
  const $ = (selector) => document.querySelector(selector);
  const elements = {
    rows: $('#order-rows'), empty: $('#empty-state'), search: $('#search'), notices: $('#notice-area'),
    dialog: $('#order-dialog'), form: $('#order-form'), formErrors: $('#form-errors'),
    customer: $('#customer-name'), service: $('#service'), date: $('#order-date'), status: $('#status'),
    deadline: $('#deadline'), note: $('#internal-note'), formId: $('#form-id'), draftOrder: $('#draft-order'),
    draftMessage: $('#draft-message'), activity: $('#activity-list'), amount: $('#order-amount'),
    customerRows: $('#customer-rows'), customerSearch: $('#customer-search'), customerEmpty: $('#customer-empty'),
    inventoryRows: $('#inventory-rows'), inventorySearch: $('#inventory-search'), inventoryEmpty: $('#inventory-empty')
  };

  const today = () => new Date().toISOString().slice(0, 10);
  const daysAgo = (days) => { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString(); };
  const sampleOrders = [
    { id: 'ORD-1042', customer: 'Jordan Lee', service: 'Website content review', orderDate: daysAgo(3).slice(0, 10), status: 'In Progress', updatedAt: daysAgo(1), deadline: '', note: '' },
    { id: 'ORD-1041', customer: 'Casey Rivera', service: 'Monthly analytics summary', orderDate: daysAgo(5).slice(0, 10), status: 'Waiting for Supplier', updatedAt: daysAgo(2), deadline: '', note: '' },
    { id: 'ORD-1040', customer: 'Taylor Morgan', service: 'Brand asset preparation', orderDate: daysAgo(12).slice(0, 10), status: 'Pending', updatedAt: daysAgo(9), deadline: '', note: '' },
    { id: 'ORD-1039', customer: 'Sam Patel', service: 'Email campaign setup', orderDate: daysAgo(8).slice(0, 10), status: 'Requires Attention', updatedAt: daysAgo(1), deadline: '', note: 'Confirm source files with the customer.' },
    { id: 'ORD-1038', customer: 'Alex Kim', service: 'Landing page copy', orderDate: daysAgo(15).slice(0, 10), status: 'Completed', updatedAt: daysAgo(4), deadline: '', note: '' },
    { id: 'ORD-1037', customer: 'Riley Chen', service: 'Product photo edit', orderDate: daysAgo(10).slice(0, 10), status: 'Cancelled', updatedAt: daysAgo(8), deadline: '', note: '' }
  ];

  function readStorage(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch (error) { console.warn(`Could not read ${key}; using a fresh copy.`, error); return fallback; }
  }
  let orders = readStorage(STORAGE_KEY, sampleOrders);
  let activity = readStorage(ACTIVITY_KEY, []);
  if (!Array.isArray(orders)) orders = sampleOrders;
  if (!Array.isArray(activity)) activity = [];
  const sampleCustomers = [...new Set(orders.map((order) => order.customer).filter(Boolean))].map((name, index) => ({ id: `CUST-${String(index + 1).padStart(3, '0')}`, name, email: '', phone: '' }));
  let customers = readStorage(CUSTOMER_KEY, sampleCustomers);
  if (!Array.isArray(customers)) customers = sampleCustomers;
  let inventory = readStorage(INVENTORY_KEY, [
    { id: 'INV-001', name: 'Shipping mailers', sku: 'MAIL-01', quantity: 42, reorderLevel: 20, unitCost: 35 },
    { id: 'INV-002', name: 'Printed welcome cards', sku: 'CARD-02', quantity: 12, reorderLevel: 20, unitCost: 18 },
    { id: 'INV-003', name: 'USB-C adapters', sku: 'ADPT-03', quantity: 8, reorderLevel: 5, unitCost: 450 }
  ]);
  if (!Array.isArray(inventory)) inventory = [];
  let storageWarning = false;
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customers));
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
      storageWarning = false;
    } catch (error) {
      storageWarning = true;
      console.error('Unable to save order data in this browser.', error);
    }
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function statusClass(status) { return `status-${status.toLowerCase().replaceAll(' ', '-')}`; }
  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }
  function formatDateTime(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  }
  function ageInDays(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return Infinity;
    return (Date.now() - date.getTime()) / 86400000;
  }
  function validateOrder(order, { forCompletion = false } = {}) {
    const errors = [];
    if (!order.customer.trim()) errors.push('Customer name is required.');
    if (!order.service.trim()) errors.push('Service requested is required.');
    if (!order.orderDate) errors.push('Order date is required.');
    else if (Number.isNaN(Date.parse(`${order.orderDate}T12:00:00`))) errors.push('Enter a valid order date.');
    else if (order.orderDate > today()) errors.push('Order date cannot be in the future.');
    if (!STATUSES.includes(order.status)) errors.push('Choose a valid order status.');
    if (order.deadline && Number.isNaN(Date.parse(`${order.deadline}T12:00:00`))) errors.push('Enter a valid verified deadline.');
    if (order.deadline && order.orderDate && order.deadline < order.orderDate) errors.push('Verified deadline cannot be before the order date.');
    if (forCompletion && (!order.customer.trim() || !order.service.trim() || !order.orderDate)) errors.push('Complete all required order information before marking this order as completed.');
    return errors;
  }
  function isDuplicate(order) {
    const key = `${order.customer.trim().toLowerCase()}|${order.service.trim().toLowerCase()}|${order.orderDate}`;
    return orders.some((other) => other.id !== order.id && `${other.customer.trim().toLowerCase()}|${other.service.trim().toLowerCase()}|${other.orderDate}` === key);
  }
  function issuesFor(order) {
    const issues = [];
    if (validateOrder(order).length) issues.push({ label: 'Incomplete details', type: 'error' });
    if (!STATUSES.includes(order.status)) issues.push({ label: 'Invalid status', type: 'error' });
    if (order.status === 'Completed' && validateOrder(order).length) issues.push({ label: 'Completed with missing details', type: 'error' });
    if (!['Completed', 'Cancelled'].includes(order.status) && ageInDays(order.updatedAt) > STALE_DAYS) issues.push({ label: `No update in ${Math.floor(ageInDays(order.updatedAt))} days`, type: 'warning' });
    if (isDuplicate(order)) issues.push({ label: 'Possible duplicate', type: 'warning' });
    if (order.status === 'Requires Attention') issues.push({ label: 'Human review requested', type: 'warning' });
    return issues;
  }
  function addActivity(orderId, message) {
    activity.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, orderId, message, at: new Date().toISOString() });
    activity = activity.slice(0, 100);
  }
  function renderMetrics() {
    $('#count-total').textContent = orders.length;
    $('#count-pending').textContent = orders.filter((order) => order.status === 'Pending').length;
    $('#count-progress').textContent = orders.filter((order) => order.status === 'In Progress').length;
    $('#count-completed').textContent = orders.filter((order) => order.status === 'Completed').length;
    $('#count-attention').textContent = orders.filter((order) => issuesFor(order).length > 0).length;
  }
  const formatMoney = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value) || 0);
  const completedWithAmount = () => orders.filter((order) => order.status === 'Completed' && order.amount !== null && order.amount !== '' && Number.isFinite(Number(order.amount)));
  function renderCustomerOptions(selectedName = elements.customer.value) {
    elements.customer.innerHTML = '<option value="">Choose a customer…</option>' + customers.map((customer) => `<option value="${escapeHtml(customer.name)}">${escapeHtml(customer.name)}</option>`).join('');
    if (customers.some((customer) => customer.name === selectedName)) elements.customer.value = selectedName;
  }
  function renderCustomers() {
    const query = elements.customerSearch.value.trim().toLowerCase();
    const filtered = customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(query));
    elements.customerRows.innerHTML = filtered.map((customer) => {
      const customerOrders = orders.filter((order) => order.customer === customer.name);
      const lastOrder = customerOrders.map((order) => order.orderDate).sort().at(-1);
      return `<tr><td><span class="customer-name">${escapeHtml(customer.name)}</span><span class="order-sub">${escapeHtml(customer.id)}</span></td><td>${escapeHtml(customer.email || '—')}</td><td>${escapeHtml(customer.phone || '—')}</td><td>${customerOrders.length}</td><td>${formatDate(lastOrder)}</td><td><button class="text-button" data-edit-customer="${escapeHtml(customer.id)}">Edit</button></td></tr>`;
    }).join('');
    elements.customerEmpty.hidden = filtered.length > 0;
    $('#customer-count').textContent = customers.length;
    $('#customer-active-count').textContent = customers.filter((customer) => orders.some((order) => order.customer === customer.name)).length;
  }
  function renderInventory() {
    const query = elements.inventorySearch.value.trim().toLowerCase();
    const filtered = inventory.filter((item) => `${item.name} ${item.sku} ${item.id}`.toLowerCase().includes(query));
    elements.inventoryRows.innerHTML = filtered.map((item) => {
      const low = Number(item.quantity) <= Number(item.reorderLevel);
      return `<tr><td><span class="customer-name">${escapeHtml(item.name)}</span></td><td>${escapeHtml(item.sku || item.id)}</td><td>${Number(item.quantity)}</td><td>${Number(item.reorderLevel)}</td><td>${formatMoney(item.unitCost)}</td><td><span class="review-tag ${low ? 'warning' : ''}">${low ? '⚠ Low stock' : '✓ In stock'}</span></td><td><button class="text-button" data-edit-item="${escapeHtml(item.id)}">Edit</button></td></tr>`;
    }).join('');
    elements.inventoryEmpty.hidden = filtered.length > 0;
    const lowItems = inventory.filter((item) => Number(item.quantity) <= Number(item.reorderLevel));
    $('#inventory-count').textContent = inventory.length;
    $('#low-stock-count').textContent = lowItems.length;
    $('#unit-count').textContent = inventory.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
    $('#stock-value').textContent = formatMoney(inventory.reduce((total, item) => total + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0));
    $('#inventory-notices').innerHTML = lowItems.length ? `<div class="warning-banner"><span>⚠</span><span><strong>${lowItems.length} item${lowItems.length === 1 ? '' : 's'} at or below reorder level.</strong> Check stock before accepting more work.</span></div>` : '';
  }
  function renderSales() {
    const eligible = completedWithAmount();
    const values = eligible.map((order) => Number(order.amount) || 0);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthSales = eligible.filter((order) => (order.completedAt || order.updatedAt || '').slice(0, 7) === currentMonth).reduce((sum, order) => sum + Number(order.amount), 0);
    $('#sales-total').textContent = formatMoney(values.reduce((sum, value) => sum + value, 0));
    $('#sales-month').textContent = formatMoney(monthSales);
    $('#sales-order-count').textContent = eligible.length;
    $('#sales-average').textContent = formatMoney(values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
    const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (5 - index), 1));
    const rows = months.map((month) => {
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const sales = eligible.filter((order) => (order.completedAt || order.updatedAt || '').slice(0, 7) === key);
      return `<tr><td>${new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)}</td><td>${sales.length}</td><td>${formatMoney(sales.reduce((sum, order) => sum + Number(order.amount), 0))}</td></tr>`;
    });
    $('#sales-rows').innerHTML = eligible.length ? rows.join('') : '';
    $('#sales-empty').hidden = eligible.length > 0;
  }
  function nextRecordId(prefix, records) {
    const numbers = records.map((record) => Number((record.id.match(/(\d+)$/) || [])[1])).filter(Number.isFinite);
    return `${prefix}-${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`;
  }
  function showDialogErrors(selector, errors) {
    const box = $(selector);
    box.hidden = errors.length === 0;
    box.innerHTML = errors.length ? `<ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : '';
  }
  function renderNotices() {
    const stale = orders.filter((order) => !['Completed', 'Cancelled'].includes(order.status) && ageInDays(order.updatedAt) > STALE_DAYS);
    const duplicates = orders.filter((order) => isDuplicate(order));
    const invalid = orders.filter((order) => !STATUSES.includes(order.status) || (order.status === 'Completed' && validateOrder(order).length));
    const messages = [];
    if (stale.length) messages.push(`<strong>${stale.length} order${stale.length === 1 ? '' : 's'} may be stale.</strong> Check orders without an update in more than ${STALE_DAYS} days.`);
    if (duplicates.length) messages.push(`<strong>${duplicates.length} possible duplicate${duplicates.length === 1 ? '' : 's'} found.</strong> Compare customer, service, and order date before taking action.`);
    if (invalid.length) messages.push(`<strong>${invalid.length} order${invalid.length === 1 ? '' : 's'} need a data check.</strong> Review required details and status.`);
    if (storageWarning) messages.push('<strong>Changes could not be saved.</strong> Browser storage may be unavailable or full.');
    elements.notices.innerHTML = messages.map((message) => `<div class="warning-banner"><span>⚠</span><span>${message}</span></div>`).join('');
  }
  function renderOrders() {
    const query = elements.search.value.trim().toLowerCase();
    const filtered = orders.filter((order) => `${order.id} ${order.customer} ${order.service} ${order.status}`.toLowerCase().includes(query));
    elements.rows.innerHTML = filtered.map((order) => {
      const issues = issuesFor(order);
      const review = issues.length ? `<span class="review-tag ${issues.some((issue) => issue.type === 'error') ? 'error' : 'warning'}">⚠ ${escapeHtml(issues[0].label)}${issues.length > 1 ? ` +${issues.length - 1}` : ''}</span>` : '<span class="review-tag">✓ Clear</span>';
      const statusOptions = STATUSES.map((status) => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`).join('');
      return `<tr>
        <td><span class="order-id">${escapeHtml(order.id)}</span><span class="order-sub">Created ${formatDate(order.orderDate)}</span></td>
        <td><span class="customer-name">${escapeHtml(order.customer || 'Missing customer')}</span><span class="service-name">${escapeHtml(order.service || 'Missing service')}</span></td>
        <td>${formatDate(order.orderDate)}</td><td>${formatDateTime(order.updatedAt)}</td><td>${order.amount === null || order.amount === undefined ? '—' : formatMoney(order.amount)}</td>
        <td><select class="status-select ${statusClass(order.status)}" data-status-id="${escapeHtml(order.id)}" aria-label="Status for ${escapeHtml(order.id)}">${statusOptions}</select></td>
        <td>${review}</td><td><div class="row-actions"><button class="text-button" data-edit-id="${escapeHtml(order.id)}">Edit</button><button class="text-button" data-draft-id="${escapeHtml(order.id)}">Draft</button></div></td>
      </tr>`;
    }).join('');
    elements.empty.hidden = filtered.length !== 0;
    $('#order-count-label').textContent = `${filtered.length} order${filtered.length === 1 ? '' : 's'}`;
  }
  function renderActivity() {
    elements.activity.innerHTML = activity.length ? activity.slice(0, 30).map((entry) => {
      const order = orders.find((item) => item.id === entry.orderId);
      return `<div class="activity-item"><span class="activity-icon">↻</span><div class="activity-copy"><strong>${escapeHtml(entry.orderId)}</strong> ${escapeHtml(entry.message)}<span class="activity-time">${formatDateTime(entry.at)}${order ? ` · ${escapeHtml(order.customer)}` : ''}</span></div></div>`;
    }).join('') : '<p class="no-activity">New orders and status changes will appear here.</p>';
  }
  function renderDraftSelector(selectedId = elements.draftOrder.value) {
    elements.draftOrder.innerHTML = orders.length ? `<option value="">Select an order…</option>${orders.map((order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.id)} · ${escapeHtml(order.customer || 'Missing customer')}</option>`).join('')}` : '<option value="">No orders yet</option>';
    if (orders.some((order) => order.id === selectedId)) elements.draftOrder.value = selectedId;
    updateDraft();
  }
  function updateDraft() {
    const order = orders.find((item) => item.id === elements.draftOrder.value);
    if (!order) { elements.draftMessage.value = ''; return; }
    const name = order.customer.trim() || 'there';
    const statusLines = {
      'Pending': 'Your order is currently pending.',
      'In Progress': 'Your order is currently in progress.',
      'Waiting for Supplier': 'Your order is currently waiting for supplier information.',
      'Requires Attention': 'Your order needs a review from our operations team. We will share an update when we have verified more information.',
      'Completed': 'Our records show that your order is marked completed.',
      'Cancelled': 'Our records show that your order is marked cancelled.'
    };
    const detailsMissing = validateOrder(order).length > 0;
    elements.draftMessage.value = `Hello ${name},\n\n${statusLines[order.status] || 'We are reviewing your order details.'}${detailsMissing ? '\nWe are checking some order details before sharing further information.' : ''}${order.deadline ? ` The verified deadline on record is ${formatDate(order.deadline)}.` : ''}\n\nPlease reply if you have any questions.`;
  }
  function render() {
    renderMetrics(); renderNotices(); renderOrders(); renderActivity(); renderDraftSelector();
    renderCustomerOptions(); renderCustomers(); renderInventory(); renderSales();
  }
  function showErrors(errors) {
    elements.formErrors.hidden = errors.length === 0;
    elements.formErrors.innerHTML = errors.length ? `<strong>Please correct the following:</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : '';
  }
  function openForm(order = null) {
    elements.form.reset(); showErrors([]);
    renderCustomerOptions(order?.customer || '');
    elements.formId.value = order?.id || '';
    $('#dialog-title').textContent = order ? `Edit ${order.id}` : 'Create order';
    elements.customer.value = order?.customer || '';
    elements.service.value = order?.service || '';
    elements.date.value = order?.orderDate || today();
    elements.status.value = order?.status || 'Pending';
    elements.amount.value = order?.amount ?? '';
    elements.deadline.value = order?.deadline || '';
    elements.note.value = order?.note || '';
    elements.dialog.showModal();
    elements.customer.focus();
  }
  function nextOrderId() {
    const numbers = orders.map((order) => Number((order.id.match(/(\d+)$/) || [])[1])).filter(Number.isFinite);
    return `ORD-${String(Math.max(1000, ...numbers) + 1)}`;
  }
  function handleSubmit(event) {
    event.preventDefault();
    const existing = orders.find((order) => order.id === elements.formId.value);
    const next = {
      id: existing?.id || nextOrderId(), customer: elements.customer.value.trim(), service: elements.service.value.trim(),
      orderDate: elements.date.value, status: elements.status.value, deadline: elements.deadline.value,
      note: elements.note.value.trim(), amount: elements.amount.value.trim() === '' ? null : Number(elements.amount.value),
      updatedAt: existing?.updatedAt || new Date().toISOString(), completedAt: existing?.completedAt || (elements.status.value === 'Completed' ? new Date().toISOString() : null)
    };
    const errors = validateOrder(next);
    if (next.amount !== null && (!Number.isFinite(next.amount) || next.amount < 0)) errors.push('Sales amount must be zero or more.');
    const requiredErrors = new Set(['Customer name is required.', 'Service requested is required.', 'Order date is required.']);
    // Keep incomplete work trackable, but never allow an incomplete order to be completed.
    const blockingErrors = next.status === 'Completed' ? errors : errors.filter((error) => !requiredErrors.has(error));
    if (next.status === 'Completed' && errors.length) blockingErrors.push('An incomplete order cannot be marked as completed.');
    if (blockingErrors.length) { showErrors([...new Set(blockingErrors)]); return; }
    if (isDuplicate(next)) {
      const proceed = window.confirm('This may duplicate an existing order with the same customer, service, and date. Save it anyway for review?');
      if (!proceed) return;
    }
    if (existing) {
      const changes = [];
      for (const key of ['customer', 'service', 'orderDate', 'status', 'deadline', 'note', 'amount']) if (existing[key] !== next[key]) changes.push(`${key} changed`);
      if (changes.length) {
        next.updatedAt = new Date().toISOString();
        orders = orders.map((order) => order.id === existing.id ? next : order);
        addActivity(existing.id, `updated order (${changes.join(', ')})`);
      } else { elements.dialog.close(); return; }
    } else {
      orders.unshift(next);
      addActivity(next.id, `created order for ${next.customer} · ${next.service}`);
    }
    save(); elements.dialog.close(); render();
  }
  function changeStatus(id, newStatus, select) {
    const order = orders.find((item) => item.id === id);
    if (!order || !STATUSES.includes(newStatus)) { render(); return; }
    if (newStatus === 'Completed') {
      const errors = validateOrder({ ...order, status: newStatus }, { forCompletion: true });
      if (errors.length) {
        window.alert(`This order cannot be completed yet:\n\n${errors.join('\n')}`);
        select.value = order.status; return;
      }
    }
    if (order.status === newStatus) return;
    const previous = order.status;
    order.status = newStatus; order.updatedAt = new Date().toISOString();
    if (newStatus === 'Completed') order.completedAt = order.updatedAt;
    addActivity(order.id, `status changed from ${previous} to ${newStatus}`);
    save(); render();
  }
  function useDraft(orderId) { elements.draftOrder.value = orderId; updateDraft(); elements.draftMessage.focus(); }

  function openCustomerForm(customer = null) {
    $('#customer-form').reset(); showDialogErrors('#customer-errors', []);
    $('#customer-edit-id').value = customer?.id || '';
    $('#customer-dialog-title').textContent = customer ? 'Edit customer' : 'Add customer';
    $('#directory-name').value = customer?.name || '';
    $('#directory-email').value = customer?.email || '';
    $('#directory-phone').value = customer?.phone || '';
    $('#customer-dialog').showModal(); $('#directory-name').focus();
  }
  function saveCustomer(event) {
    event.preventDefault();
    const id = $('#customer-edit-id').value;
    const existing = customers.find((customer) => customer.id === id);
    const customer = { id: existing?.id || nextRecordId('CUST', customers), name: $('#directory-name').value.trim(), email: $('#directory-email').value.trim(), phone: $('#directory-phone').value.trim() };
    const errors = [];
    if (!customer.name) errors.push('Customer name is required.');
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) errors.push('Enter a valid email address.');
    if (customers.some((item) => item.id !== id && item.name.toLowerCase() === customer.name.toLowerCase())) errors.push('A customer with this name already exists.');
    if (errors.length) { showDialogErrors('#customer-errors', errors); return; }
    if (existing) {
      const oldName = existing.name;
      customers = customers.map((item) => item.id === id ? customer : item);
      if (oldName !== customer.name) orders.forEach((order) => { if (order.customer === oldName) order.customer = customer.name; });
      addActivity(customer.id, `customer record updated for ${customer.name}`);
    } else {
      customers.unshift(customer);
      addActivity(customer.id, `customer added: ${customer.name}`);
    }
    save(); $('#customer-dialog').close(); render();
  }
  function openInventoryForm(item = null) {
    $('#inventory-form').reset(); showDialogErrors('#inventory-errors', []);
    $('#inventory-edit-id').value = item?.id || '';
    $('#inventory-dialog-title').textContent = item ? 'Edit inventory item' : 'Add inventory item';
    $('#item-name').value = item?.name || ''; $('#item-sku').value = item?.sku || '';
    $('#item-quantity').value = item?.quantity ?? 0; $('#item-reorder').value = item?.reorderLevel ?? 0;
    $('#item-cost').value = item?.unitCost ?? '';
    $('#inventory-dialog').showModal(); $('#item-name').focus();
  }
  function saveInventoryItem(event) {
    event.preventDefault();
    const id = $('#inventory-edit-id').value;
    const existing = inventory.find((item) => item.id === id);
    const name = $('#item-name').value.trim(), sku = $('#item-sku').value.trim();
    const quantity = Number($('#item-quantity').value), reorderLevel = Number($('#item-reorder').value);
    const costText = $('#item-cost').value.trim(), unitCost = costText === '' ? 0 : Number(costText);
    const errors = [];
    if (!name) errors.push('Item name is required.');
    if (!Number.isInteger(quantity) || quantity < 0) errors.push('Quantity must be a whole number of zero or more.');
    if (!Number.isInteger(reorderLevel) || reorderLevel < 0) errors.push('Reorder level must be a whole number of zero or more.');
    if (!Number.isFinite(unitCost) || unitCost < 0) errors.push('Unit cost must be zero or more.');
    if (sku && inventory.some((item) => item.id !== id && item.sku && item.sku.toLowerCase() === sku.toLowerCase())) errors.push('That SKU is already in use.');
    if (errors.length) { showDialogErrors('#inventory-errors', errors); return; }
    const item = { id: existing?.id || nextRecordId('INV', inventory), name, sku, quantity, reorderLevel, unitCost };
    if (existing) { inventory = inventory.map((current) => current.id === id ? item : current); addActivity(item.id, `inventory updated: ${item.name} (${quantity} in stock)`); }
    else { inventory.unshift(item); addActivity(item.id, `inventory item added: ${item.name} (${quantity} in stock)`); }
    save(); $('#inventory-dialog').close(); render();
  }

  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.view;
    document.querySelectorAll('.app-view').forEach((view) => { view.hidden = view.id !== `view-${selected}`; });
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
  }));
  $('#new-customer').addEventListener('click', () => openCustomerForm());
  $('#customer-form').addEventListener('submit', saveCustomer);
  $('#customer-search').addEventListener('input', renderCustomers);
  elements.customerRows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-customer]');
    if (button) openCustomerForm(customers.find((customer) => customer.id === button.dataset.editCustomer));
  });
  $('#new-item').addEventListener('click', () => openInventoryForm());
  $('#inventory-form').addEventListener('submit', saveInventoryItem);
  $('#inventory-search').addEventListener('input', renderInventory);
  elements.inventoryRows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-item]');
    if (button) openInventoryForm(inventory.find((item) => item.id === button.dataset.editItem));
  });
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));

  for (const status of STATUSES) elements.status.add(new Option(status, status));
  $('#new-order').addEventListener('click', () => openForm());
  $('#close-dialog').addEventListener('click', () => elements.dialog.close());
  $('#cancel-dialog').addEventListener('click', () => elements.dialog.close());
  elements.form.addEventListener('submit', handleSubmit);
  elements.search.addEventListener('input', renderOrders);
  elements.draftOrder.addEventListener('change', updateDraft);
  $('#copy-draft').addEventListener('click', async () => {
    const message = elements.draftMessage.value;
    if (!message) { $('#copy-feedback').textContent = 'Choose an order first.'; return; }
    try { await navigator.clipboard.writeText(message); $('#copy-feedback').textContent = 'Draft copied. It has not been sent.'; }
    catch { elements.draftMessage.select(); $('#copy-feedback').textContent = 'Select and copy the draft manually. It has not been sent.'; }
  });
  elements.rows.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-id]');
    const draftButton = event.target.closest('[data-draft-id]');
    if (editButton) openForm(orders.find((order) => order.id === editButton.dataset.editId));
    if (draftButton) useDraft(draftButton.dataset.draftId);
  });
  elements.rows.addEventListener('change', (event) => {
    const select = event.target.closest('[data-status-id]');
    if (select) changeStatus(select.dataset.statusId, select.value, select);
  });
  render();
})();

