// Synthetic purchase orders linked to opportunities.
// Statuses: 'Open', 'In Fulfillment', 'Shipped', 'Delivered', 'On Hold', 'Cancelled'
// Value in USD. Ordered/expected dates are ISO date strings.
export const orders = [
  { id: 5001, opportunity_id: 4, account_id: 4, order_number: 'PO-2026-4088', status: 'In Fulfillment', amount: 210000, items: 6, ordered_at: '2026-09-01', expected_ship_date: '2026-09-28', notes: 'Site 1 hardware batch, Atlas Manufacturing' },
  { id: 5002, opportunity_id: 4, account_id: 4, order_number: 'PO-2026-4089', status: 'Shipped', amount: 145000, items: 4, ordered_at: '2026-08-24', expected_ship_date: '2026-09-15', notes: 'Site 2 hardware batch, Atlas Manufacturing' },
  { id: 5003, opportunity_id: 7, account_id: 1, order_number: 'PO-2026-3402', status: 'Delivered', amount: 320000, items: 12, ordered_at: '2026-08-05', expected_ship_date: '2026-08-29', notes: 'Renewal — core platform license, Northwind Logistics' },
  { id: 5004, opportunity_id: 7, account_id: 1, order_number: 'PO-2026-3403', status: 'In Fulfillment', amount: 190000, items: 3, ordered_at: '2026-08-30', expected_ship_date: '2026-10-02', notes: 'Renewal — services add-on, Northwind Logistics' },
  { id: 5005, opportunity_id: 1, account_id: 1, order_number: 'PO-2026-4501', status: 'Open', amount: 85000, items: 2, ordered_at: '2026-09-10', expected_ship_date: '2026-10-18', notes: 'Fleet pilot hardware, Northwind Logistics' },
  { id: 5006, opportunity_id: 5, account_id: 5, order_number: 'PO-2026-4622', status: 'Open', amount: 120000, items: 5, ordered_at: '2026-09-08', expected_ship_date: '2026-10-15', notes: 'Compliance reporting bundle, Harbor Finance Group' },
  { id: 5007, opportunity_id: 8, account_id: 3, order_number: 'PO-2026-4711', status: 'On Hold', amount: 95000, items: 3, ordered_at: '2026-08-28', expected_ship_date: '2026-10-05', notes: 'Awaiting store rollout schedule, Brightline Retail' },
  { id: 5008, opportunity_id: 2, account_id: 2, order_number: 'PO-2026-4820', status: 'Open', amount: 65000, items: 2, ordered_at: '2026-09-14', expected_ship_date: '2026-10-22', notes: 'Clinical rollout pilot batch, Summit Health' },
  { id: 5009, opportunity_id: 6, account_id: 6, order_number: 'PO-2026-4901', status: 'Cancelled', amount: 40000, items: 1, ordered_at: '2026-08-12', expected_ship_date: '2026-09-30', notes: 'Cancelled by customer procurement, Pioneer Energy' }
];
