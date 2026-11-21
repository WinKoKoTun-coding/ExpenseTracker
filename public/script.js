const API = "/api/transactions";
const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Health",
  "Entertainment",
  "Education",
  "Other",
];
const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Investment",
  "Gift",
  "Other",
];
const COLORS = [
  "#786ce9",
  "#f2a65a",
  "#55c5a0",
  "#ed7d91",
  "#6ea9e8",
  "#b38be7",
  "#e5c65e",
  "#8c96aa",
];
const $ = (selector) => document.querySelector(selector);

let transactions = [];
let editingId = null;
let showAll = false;

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const monthKey = (date) => date.slice(0, 7);

async function api(url = API, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error || "Something went wrong.");
  return payload;
}

async function loadTransactions() {
  try {
    transactions = await api();
    render();
  } catch (error) {
    $("#transactionRows").innerHTML =
      `<tr><td colspan="5" class="empty-cell">${escapeHTML(error.message)} Start the app with <strong>node server.js</strong>.</td></tr>`;
    toast(error.message);
  }
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function render() {
  renderSummary();
  renderTransactions();
  renderCategoryFilter();
  renderChart();
  renderCategories();
}

function renderSummary() {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const currentMonth = monthKey(today());
  const monthExpenses = transactions.filter(
    (t) => t.type === "expense" && monthKey(t.date) === currentMonth,
  );
  const monthTotal = monthExpenses.reduce((sum, t) => sum + t.amount, 0);

  $("#totalBalance").textContent = `MMK ${money(income - expense)}`;
  $("#totalIncome").textContent = `MMK ${money(income)}`;
  $("#totalExpense").textContent = `MMK ${money(expense)}`;
  $("#monthExpense").textContent = `MMK ${money(monthTotal)}`;
  $("#monthCount").textContent =
    `${monthExpenses.length} transaction${monthExpenses.length === 1 ? "" : "s"}`;
  $("#todayLabel").textContent = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

function renderTransactions() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const type = $("#typeFilter").value;
  const category = $("#categoryFilter").value;

  const filtered = transactions.filter((t) => {
    const matchesQuery = `${t.description} ${t.category} ${t.note || ""}`
      .toLowerCase()
      .includes(query);
    return (
      matchesQuery &&
      (type === "all" || t.type === type) &&
      (category === "all" || t.category === category)
    );
  });
  const visible = showAll ? filtered : filtered.slice(0, 6);

  if (!visible.length) {
    $("#transactionRows").innerHTML =
      `<tr><td colspan="5" class="empty-cell">No transactions found. Add your first transaction to get started.</td></tr>`;
  } else {
    $("#transactionRows").innerHTML = visible
      .map((t) => {
        const income = t.type === "income";
        const symbol = income ? "↗" : "↘";
        return `<tr>
        <td><div class="transaction-name"><span class="transaction-symbol ${t.type}">${symbol}</span><span>${escapeHTML(t.description)}</span></div></td>
        <td><span class="category-chip">${escapeHTML(t.category)}</span></td>
        <td>${dateLabel(t.date)}</td>
        <td class="amount-cell ${t.type}">${income ? "+" : "−"} MMK ${money(t.amount)}</td>
        <td><div class="row-actions"><button class="row-action" data-action="edit" data-id="${escapeHTML(t.id)}" title="Edit">✎</button><button class="row-action" data-action="delete" data-id="${escapeHTML(t.id)}" title="Delete">⌫</button></div></td>
      </tr>`;
      })
      .join("");
  }
  $("#resultCount").textContent =
    `Showing ${visible.length} of ${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`;
  $("#viewAllButton").innerHTML = showAll
    ? "Show less <span>↑</span>"
    : "View all <span>→</span>";
}

function renderCategoryFilter() {
  const select = $("#categoryFilter");
  const current = select.value;
  const categories = [...new Set(transactions.map((t) => t.category))].sort();
  select.innerHTML = `<option value="all">All categories</option>${categories.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("")}`;
  select.value = categories.includes(current) ? current : "all";
}

function renderChart() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: date.toLocaleDateString("en-US", { month: "short" }),
      income: 0,
      expense: 0,
    });
  }
  transactions.forEach((t) => {
    const month = months.find((m) => m.key === monthKey(t.date));
    if (month) month[t.type] += t.amount;
  });
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  $("#monthlyChart").innerHTML = months
    .map((m) => {
      const incomeHeight = Math.max(m.income ? 3 : 0, (m.income / max) * 100);
      const expenseHeight = Math.max(
        m.expense ? 3 : 0,
        (m.expense / max) * 100,
      );
      return `<div class="month-group" title="${m.label}: income MMK ${money(m.income)}, expenses MMK ${money(m.expense)}">
      <div class="bar" style="height:${incomeHeight}%"></div><div class="bar expense" style="height:${expenseHeight}%"></div>
    </div>`;
    })
    .join("");
  $("#monthLabels").innerHTML = months
    .map((m) => `<span>${m.label}</span>`)
    .join("");
}

function renderCategories() {
  const totals = {};
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  $("#donutTotal").textContent =
    total >= 1_000_000
      ? `${(total / 1_000_000).toFixed(1)}M`
      : total >= 1000
        ? `${(total / 1000).toFixed(0)}K`
        : money(total);

  if (!total) {
    $("#categoryDonut").style.background = "conic-gradient(#e9e7fb 0 100%)";
    $("#categoryLegend").innerHTML =
      '<div class="empty-mini">Add expenses to see your categories.</div>';
    return;
  }
  let cursor = 0;
  const segments = entries.map(([name, value], index) => {
    const start = cursor;
    cursor += (value / total) * 100;
    return `${COLORS[index % COLORS.length]} ${start}% ${cursor}%`;
  });
  $("#categoryDonut").style.background =
    `conic-gradient(${segments.join(",")})`;
  $("#categoryLegend").innerHTML = entries
    .slice(0, 6)
    .map(
      ([name, value], index) => `
    <div class="legend-item"><i class="legend-swatch" style="background:${COLORS[index % COLORS.length]}"></i><span>${escapeHTML(name)}</span><strong>${Math.round((value / total) * 100)}%</strong></div>
  `,
    )
    .join("");
}

function setType(type) {
  $("#transactionType").value = type;
  document
    .querySelectorAll(".type-option")
    .forEach((button) =>
      button.classList.toggle("selected", button.dataset.type === type),
    );
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  $("#category").innerHTML = categories
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
}

function openModal(transaction = null) {
  editingId = transaction?.id || null;
  $("#modalTitle").textContent = transaction
    ? "Edit transaction"
    : "Add transaction";
  $("#saveButton").innerHTML = transaction
    ? "Update transaction <span>→</span>"
    : "Save transaction <span>→</span>";
  $("#transactionForm").reset();
  setType(transaction?.type || "expense");
  $("#description").value = transaction?.description || "";
  $("#amount").value = transaction?.amount ?? "";
  $("#date").value = transaction?.date || today();
  $("#note").value = transaction?.note || "";
  if (transaction) $("#category").value = transaction.category;
  $("#formError").textContent = "";
  $("#transactionModal").classList.add("open");
  $("#transactionModal").setAttribute("aria-hidden", "false");
  setTimeout(() => $("#description").focus(), 50);
}

function closeModal() {
  $("#transactionModal").classList.remove("open");
  $("#transactionModal").setAttribute("aria-hidden", "true");
  editingId = null;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

async function saveTransaction(event) {
  event.preventDefault();
  const payload = {
    type: $("#transactionType").value,
    description: $("#description").value.trim(),
    amount: Number($("#amount").value),
    category: $("#category").value,
    date: $("#date").value,
    note: $("#note").value.trim(),
  };
  try {
    const button = $("#saveButton");
    button.disabled = true;
    const saved = await api(
      editingId ? `${API}/${encodeURIComponent(editingId)}` : API,
      {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      },
    );
    await loadTransactions();
    closeModal();
    toast(
      editingId
        ? "Transaction updated successfully."
        : "Transaction added successfully.",
    );
  } catch (error) {
    $("#formError").textContent = error.message;
  } finally {
    $("#saveButton").disabled = false;
  }
}

async function handleTableAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const transaction = transactions.find((t) => t.id === button.dataset.id);
  if (!transaction) return;
  if (button.dataset.action === "edit") openModal(transaction);
  if (button.dataset.action === "delete") {
    if (!confirm(`Delete "${transaction.description}"? This cannot be undone.`))
      return;
    try {
      await api(`${API}/${encodeURIComponent(transaction.id)}`, {
        method: "DELETE",
      });
      await loadTransactions();
      toast("Transaction deleted.");
    } catch (error) {
      toast(error.message);
    }
  }
}

$("#addTopButton").addEventListener("click", () => openModal());
$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);
$("#transactionModal").addEventListener("click", (e) => {
  if (e.target === $("#transactionModal")) closeModal();
});
$("#transactionForm").addEventListener("submit", saveTransaction);
document
  .querySelectorAll(".type-option")
  .forEach((button) =>
    button.addEventListener("click", () => setType(button.dataset.type)),
  );
$("#transactionRows").addEventListener("click", handleTableAction);
$("#searchInput").addEventListener("input", renderTransactions);
$("#typeFilter").addEventListener("change", renderTransactions);
$("#categoryFilter").addEventListener("change", renderTransactions);
$("#viewAllButton").addEventListener("click", () => {
  showAll = !showAll;
  renderTransactions();
});
$("#refreshButton").addEventListener("click", loadTransactions);
$("#menuButton").addEventListener("click", () =>
  $("#sidebar").classList.toggle("open"),
);
document
  .querySelectorAll(".nav-link")
  .forEach((link) =>
    link.addEventListener("click", () =>
      $("#sidebar").classList.remove("open"),
    ),
  );
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

loadTransactions();
