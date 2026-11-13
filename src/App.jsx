import { useState, useEffect } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

const CATEGORY_CONFIG = {
  Food: { icon: "🍔", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)" },
  Utilities: { icon: "⚡", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  Entertainment: {
    icon: "🎬",
    color: "#a855f7",
    bg: "rgba(168, 85, 247, 0.15)",
  },
  Other: { icon: "📦", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
};

function App() {
  const [expenses, setExpenses] = useState([]);
  const [isFetching, setIsFetching] = useState(true);

  // --- DYNAMIC API CURRENCY STATES ---
  const [targetCurrency, setTargetCurrency] = useState("USD");
  const [exchangeRates, setExchangeRates] = useState({ USD: 1 });
  const [isRatesLoading, setIsRatesLoading] = useState(true);

  // Fetch live exchange rates on load
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.rates) {
          setExchangeRates(data.rates);
        }
        setIsRatesLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch live exchange rates:", err);
        setIsRatesLoading(false);
      });
  }, []);

  // Fetch expenses from Supabase on load
  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    setIsFetching(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching expenses from Supabase:", error);
    } else {
      setExpenses(data || []);
    }
    setIsFetching(false);
  }

  // Dynamically generate currency list directly from API keys
  const availableCurrencies = Object.keys(exchangeRates);

  // Dynamic conversion + native browser symbol formatting
  const formatCurrency = (amountInUSD) => {
    const rate = exchangeRates[targetCurrency] || 1;
    const converted = amountInUSD * rate;

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: targetCurrency,
    }).format(converted);
  };

  // Form States
  const today = new Date().toISOString().split("T")[0];
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState(today);
  const [editingId, setEditingId] = useState(null);

  // Filter, Search & Sort States
  const [filterCategory, setFilterCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const processedExpenses = expenses
    .filter((item) => {
      const matchesCategory =
        filterCategory === "All" || item.category === filterCategory;
      const matchesSearch = item.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "highest") return b.amount - a.amount;
      if (sortBy === "lowest") return a.amount - b.amount;
      return new Date(b.date) - new Date(a.date);
    });

  const filteredTotalUSD = processedExpenses.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const overallTotalUSD = expenses.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );

  const categoryTotals = Object.keys(CATEGORY_CONFIG).map((cat) => {
    const sumUSD = expenses
      .filter((item) => item.category === cat)
      .reduce((acc, item) => acc + Number(item.amount), 0);
    const percentage =
      overallTotalUSD > 0 ? (sumUSD / overallTotalUSD) * 100 : 0;
    return {
      name: cat,
      sumUSD,
      percentage,
      ...CATEGORY_CONFIG[cat],
    };
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount || !date) return;

    if (editingId !== null) {
      // Update record in Supabase
      const { error } = await supabase
        .from("expenses")
        .update({
          title,
          amount: parseFloat(amount),
          category,
          date,
        })
        .eq("id", editingId);

      if (error) {
        alert("Error updating expense: " + error.message);
        console.error("Error updating expense:", error);
        return;
      }

      setExpenses(
        expenses.map((item) =>
          item.id === editingId
            ? { ...item, title, amount: parseFloat(amount), category, date }
            : item,
        ),
      );
      setEditingId(null);
    } else {
      // Insert new record into Supabase
      const newExpense = {
        title,
        amount: parseFloat(amount),
        category,
        date,
      };

      const { data, error } = await supabase
        .from("expenses")
        .insert([newExpense])
        .select();

      if (error) {
        alert("Error adding expense: " + error.message);
        console.error("Error adding expense:", error);
        return;
      } else if (data && data.length > 0) {
        setExpenses([data[0], ...expenses]);
      }
    }

    setTitle("");
    setAmount("");
    setDate(today);
    setCategory("Food");
  };

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setTitle(item.title);
    setAmount(item.amount.toString());
    setCategory(item.category);
    setDate(item.date);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setDate(today);
    setCategory("Food");
  };

  const handleDeleteExpense = async (id) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      console.error("Error deleting expense:", error);
      return;
    }

    setExpenses(expenses.filter((item) => item.id !== id));
    if (editingId === id) handleCancelEdit();
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all expenses?")) return;

    const { error } = await supabase.from("expenses").delete().neq("id", 0);
    if (error) {
      console.error("Error clearing expenses:", error);
      return;
    }

    setExpenses([]);
    handleCancelEdit();
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header">
        <div>
          <h1>ExpenseFlow</h1>
          <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
            {isRatesLoading
              ? "Fetching live global currencies..."
              : `🌐 ${availableCurrencies.length} live currencies loaded (Supabase Cloud)`}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            className="modern-input"
            style={{ width: "110px", padding: "6px 10px", fontSize: "13px" }}
            value={targetCurrency}
            onChange={(e) => setTargetCurrency(e.target.value)}
          >
            {availableCurrencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          {expenses.length > 0 && (
            <button onClick={handleClearAll} className="reset-btn">
              Clear All
            </button>
          )}
        </div>
      </header>

      {/* Top Analytics Section */}
      <section className="analytics-grid">
        <div className="glass-card">
          <p className="total-label">Total Spending ({targetCurrency})</p>
          <div className="total-amount">{formatCurrency(filteredTotalUSD)}</div>
          <span className="transaction-count">
            {processedExpenses.length}{" "}
            {processedExpenses.length === 1 ? "Transaction" : "Transactions"}
          </span>
        </div>

        <div className="glass-card">
          <p className="total-label">Category Breakdown ({targetCurrency})</p>
          <div className="breakdown-bar">
            {categoryTotals.map((cat) => (
              <div
                key={cat.name}
                style={{
                  width: `${cat.percentage}%`,
                  backgroundColor: cat.color,
                  transition: "width 0.4s ease",
                }}
              />
            ))}
          </div>
          <div className="legend-grid">
            {categoryTotals.map((cat) => (
              <div key={cat.name} className="legend-item">
                <span>
                  <span
                    className="legend-dot"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </span>
                <strong>{formatCurrency(cat.sumUSD)}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Split Grid */}
      <main className="main-grid" style={{ gridTemplateColumns: "1fr" }}>
        {/* Form Card & History Combined Full Layout */}
        <div className="glass-card">
          <h3
            style={{ fontSize: "16px", color: "#e2e8f0", marginBottom: "12px" }}
          >
            {editingId ? "Edit Transaction" : "New Transaction"}
          </h3>
          <form onSubmit={handleSubmit} className="form-group">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                gap: "10px",
              }}
            >
              <input
                type="text"
                className="modern-input"
                placeholder="Expense Title (e.g. Lunch)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                className="modern-input"
                placeholder="Amount ($)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select
                className="modern-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Food">🍔 Food</option>
                <option value="Utilities">⚡ Utilities</option>
                <option value="Entertainment">🎬 Entertainment</option>
                <option value="Other">📦 Other</option>
              </select>
              <input
                type="date"
                className="modern-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <button
                type="submit"
                className={`btn-primary ${editingId ? "btn-update" : ""}`}
                style={{ whiteSpace: "nowrap" }}
              >
                {editingId ? "Update" : "+ Add"}
              </button>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="btn-cancel"
                style={{ marginTop: "8px" }}
              >
                Cancel Edit
              </button>
            )}
          </form>
        </div>

        {/* History & Controls Section */}
        <div>
          <div className="toolbar">
            <input
              type="text"
              className="modern-input"
              style={{ flex: 1 }}
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="modern-input"
              style={{ width: "155px" }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="highest">Highest Amount</option>
              <option value="lowest">Lowest Amount</option>
            </select>
          </div>

          <div className="filter-pills">
            {["All", ...Object.keys(CATEGORY_CONFIG)].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`pill ${filterCategory === cat ? "active" : ""}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="expense-list">
            {isFetching ? (
              <div
                className="glass-card"
                style={{ textAlign: "center", color: "#94a3b8" }}
              >
                Loading cloud expenses...
              </div>
            ) : processedExpenses.length > 0 ? (
              processedExpenses.map((item) => {
                const config =
                  CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.Other;
                return (
                  <div key={item.id} className="expense-card">
                    <div className="card-left">
                      <div
                        className="category-icon"
                        style={{
                          backgroundColor: config.bg,
                          color: config.color,
                        }}
                      >
                        {config.icon}
                      </div>
                      <div>
                        <div className="card-title">{item.title}</div>
                        <div className="card-meta">
                          {item.category} • {item.date}
                        </div>
                      </div>
                    </div>

                    <div className="card-right">
                      <span className="card-amount">
                        -{formatCurrency(item.amount)}
                      </span>
                      <button
                        onClick={() => handleEditClick(item)}
                        className="icon-btn"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(item.id)}
                        className="icon-btn"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className="glass-card"
                style={{ textAlign: "center", color: "#64748b" }}
              >
                No matching expenses found.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
