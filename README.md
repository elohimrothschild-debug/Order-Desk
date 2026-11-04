# Order Desk

A beginner-friendly order and operations dashboard built with plain HTML, CSS, and JavaScript. It runs locally in your browser and saves records in that browser using `localStorage`.

## Files

- `index.html` contains the dashboard, navigation, forms, and tables.
- `styles.css` controls the layout, colors, status labels, and small-screen design.
- `app.js` handles orders, customer records, inventory, reports, validation, and browser storage.

## Run it locally

1. Open this folder in File Explorer.
2. Double-click `index.html` (or right-click and choose a browser).
3. Use the tabs under the header to switch between Orders, Customers, Inventory, and Sales reports.

No install or account is needed. The starter examples use fictional names and sample stock only.

## Try a short demo

1. In **Customers**, add a fictional customer with an email or phone number.
2. In **Orders**, create an order for that customer and enter a sales amount in PHP.
3. Change the order to **Completed**. The sales report includes its amount only after completion.
4. In **Inventory**, edit an item quantity to a value at or below its reorder level to show the low-stock warning.
5. Return to **Sales reports** to see total completed sales and the six-month summary.
6. Show the order activity log and customer update draft. Drafts are never sent automatically.

## How the extra sections work

- **Customers:** customer contact records are selectable when creating an order. Renaming a customer updates their saved orders.
- **Inventory:** quantity, reorder level, SKU, and optional unit cost are saved per item. Items at or below reorder level are highlighted. Stock value is a simple quantity-times-unit-cost estimate.
- **Sales reports:** completed orders with a recorded amount are included. Monthly totals use the date the order was marked completed (or the last updated date for older sample records). Values are shown in Philippine pesos (PHP).

## Validation and local data

Order name, service, date, and status are checked; incomplete orders can be saved for follow-up but cannot be marked completed. Future order dates, invalid amounts, and deadlines before the order date are rejected. Possible duplicate orders need confirmation. Inventory quantities and reorder levels must be whole numbers of zero or more. Customer names and SKUs are checked for duplicates.

This starter app has no server, login, backup, or sync between devices. Clearing browser site data can remove saved records. Use the same browser and computer to see your changes.
