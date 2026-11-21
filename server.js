const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "transactions.json");

function ensureDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function readTransactions() {
  ensureDatabase();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error("Database file contains invalid JSON.");
  }
}

function writeTransactions(items) {
  ensureDatabase();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

function send(
  res,
  status,
  payload,
  contentType = "application/json; charset=utf-8",
) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(
    contentType.startsWith("application/json")
      ? JSON.stringify(payload)
      : payload,
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

function validateTransaction(input) {
  const type = input.type;
  const amount = Number(input.amount);
  const description = String(input.description || "").trim();
  const category = String(input.category || "").trim();
  const date = String(input.date || "");

  if (!["income", "expense"].includes(type))
    return "Type must be income or expense.";
  if (!Number.isFinite(amount) || amount <= 0)
    return "Amount must be greater than zero.";
  if (!description) return "Description is required.";
  if (!category) return "Category is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
    return "A valid date is required.";
  return null;
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (
    !filePath.startsWith(PUBLIC_DIR + path.sep) &&
    filePath !== path.join(PUBLIC_DIR, "index.html")
  ) {
    return send(res, 403, { error: "Forbidden." });
  }
  fs.readFile(filePath, (err, content) => {
    if (err) return send(res, 404, { error: "File not found." });
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml",
    };
    send(res, 200, content, types[ext] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    try {
      if (req.method === "GET" && pathname === "/api/transactions") {
        return send(
          res,
          200,
          readTransactions().sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              b.createdAt.localeCompare(a.createdAt),
          ),
        );
      }

      if (req.method === "POST" && pathname === "/api/transactions") {
        const input = await readBody(req);
        const problem = validateTransaction(input);
        if (problem) return send(res, 400, { error: problem });
        const items = readTransactions();
        const now = new Date().toISOString();
        const transaction = {
          id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: input.type,
          description: String(input.description).trim(),
          category: String(input.category).trim(),
          amount: Number(input.amount),
          date: input.date,
          note: String(input.note || "").trim(),
          createdAt: now,
          updatedAt: now,
        };
        items.push(transaction);
        writeTransactions(items);
        return send(res, 201, transaction);
      }

      const match = pathname.match(/^\/api\/transactions\/([^/]+)$/);
      if (match && req.method === "PUT") {
        const input = await readBody(req);
        const problem = validateTransaction(input);
        if (problem) return send(res, 400, { error: problem });
        const items = readTransactions();
        const index = items.findIndex((item) => item.id === match[1]);
        if (index === -1)
          return send(res, 404, { error: "Transaction not found." });
        items[index] = {
          ...items[index],
          type: input.type,
          description: String(input.description).trim(),
          category: String(input.category).trim(),
          amount: Number(input.amount),
          date: input.date,
          note: String(input.note || "").trim(),
          updatedAt: new Date().toISOString(),
        };
        writeTransactions(items);
        return send(res, 200, items[index]);
      }

      if (match && req.method === "DELETE") {
        const items = readTransactions();
        const next = items.filter((item) => item.id !== match[1]);
        if (next.length === items.length)
          return send(res, 404, { error: "Transaction not found." });
        writeTransactions(next);
        return send(res, 200, { message: "Transaction deleted." });
      }

      return send(res, 404, { error: "API endpoint not found." });
    } catch (error) {
      return send(res, 500, { error: error.message || "Server error." });
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD")
    return send(res, 405, { error: "Method not allowed." });
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  ensureDatabase();
  console.log(`Expense Tracker is running at http://localhost:${PORT}`);
});
