# Spendwise — Expense Tracker

A responsive personal expense tracker built with **vanilla HTML, CSS, JavaScript, and Node.js**. Transactions are stored in a local JSON file.

## Features

- Dashboard totals for balance, income, expenses, and current-month spending
- Create, read, update, and delete transactions
- Income and expense categories
- Search and filter transactions
- Six-month income/expense chart
- Expense category breakdown
- Responsive desktop, tablet, and mobile layout
- JSON file storage — no database or external Node packages required

## Requirements

- Node.js 18+ recommended
- A modern browser

## Run locally

```bash
node server.js
```

Open [http://localhost:3000](http://localhost:3000).

No `npm install` is needed. The server uses Node.js built-in modules only.

## Project structure

```text
expense-tracker/
├── server.js
├── data/
│   └── transactions.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/transactions` | Get all transactions |
| POST | `/api/transactions` | Create a transaction |
| PUT | `/api/transactions/:id` | Update a transaction |
| DELETE | `/api/transactions/:id` | Delete a transaction |

Example POST body:

```json
{
  "type": "expense",
  "description": "Lunch",
  "amount": 8500,
  "category": "Food & Dining",
  "date": "2026-11-21",
  "note": "With friends"
}
```

## Data

Transactions are saved in `data/transactions.json`. Back up this file to preserve your records.

## Notes

- Amounts are displayed in MMK.
- The dashboard balance is calculated as total income minus total expenses across all recorded transactions.
- The chart displays the latest six calendar months.
- This is a local learning project, not a production financial service. Add authentication, authorization, backups, and stronger deployment security before exposing it publicly.
