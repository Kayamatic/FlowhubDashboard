---
name: hourly-transaction-detail
description: >
  Breaks out all individual transactions for a specific hour of the day with full
  line-item detail. Use this skill any time the user asks to "list", "break out",
  "show", or "detail" sales for a specific hour — e.g. "list all 11am sales",
  "show me every transaction at 2pm today", "break out the 3pm hour", "what did
  people buy during the noon hour", "give me transaction detail for 11am". Also
  use when the user asks for a specific hour plus a date ("11am yesterday",
  "9am on Monday"). Prefer this over get_hourly_breakdown whenever the question
  asks for individual transactions or line items, not just totals.
---

## What this skill does

Calls the `get_hourly_transactions` tool to retrieve every individual sale that
occurred during one clock-hour on one day. Returns each transaction with:

- **Time** (HH:MM in America/New_York)
- **Customer name**
- **Order total** (after discounts)
- **Discount amount** (shown only when > $0)
- **Line items**: product name, quantity, price

## How to invoke

Use the `get_hourly_transactions` tool with:

| Parameter | Type    | Notes |
|-----------|---------|-------|
| `hour`    | integer | **Required.** 24-hour: 11 = 11am, 13 = 1pm, 0 = midnight |
| `date`    | string  | YYYY-MM-DD. Omit to default to today (America/New_York). |

## Parsing the hour from user input

| User says        | `hour` value |
|------------------|-------------|
| "11am"           | 11          |
| "noon" / "12pm"  | 12          |
| "1pm" / "13:00"  | 13          |
| "midnight"       | 0           |
| "9am"            | 9           |

## Formatting the response

After the tool returns, present a clean list. Example format:

```
**11am — March 10, 2026** | 8 transactions | $412.50 total | avg basket $51.56

1. 11:03 — Jane D.  →  $67.00
   • Galactic Warhead 3.5g Flower × 1  $45.00
   • Oreoz Pre-Roll 5pk × 1  $22.00

2. 11:11 — Mike T.  →  $38.50  (discount: $6.50)
   • Blue Dream Cart 1g × 1  $38.50
...
```

- Number each transaction sequentially
- Show discount only if > $0
- If there are many transactions (10+), offer to generate a CSV with `generate_csv`
- Summarize totals at the top (count, revenue, avg basket)

## When to use `get_hourly_breakdown` instead

If the user asks "what were our busiest hours?" or "show me hourly totals for today"
with no mention of wanting individual transactions, use `get_hourly_breakdown` — it's
faster and returns a summary-level hour-by-hour table, not per-transaction detail.
