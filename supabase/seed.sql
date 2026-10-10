-- ==============================================================================
-- Inventory Management System - Initial Seed Data
-- Run this in the Supabase Dashboard -> SQL Editor (after schema.sql)
-- ==============================================================================

-- Categories
INSERT INTO public.categories (id, name, description) VALUES
('C1', 'Stationery', 'Pens, markers, paper, notebooks'),
('C2', 'IT Equipment', 'Laptop, desktop, printer, projector'),
('C3', 'Furniture', 'Desk, chair, cabinet'),
('C4', 'Library', 'Books and learning materials'),
('C5', 'Science Lab', 'Chemicals and lab equipment'),
('C6', 'Sports Equipment', 'Football, volleyball, cones'),
('C7', 'Cleaning Supplies', 'Soap, tissue, sanitizer'),
('C8', 'Electrical Equipment', 'Fans, lights, cables'),
('C9', 'ID Card Supplies', 'PVC cards, ribbon, lanyards')
ON CONFLICT (id) DO NOTHING;

-- Warehouses
INSERT INTO public.warehouses (id, name, location, manager, capacity) VALUES
('WH001', 'Main Store', 'Building A, Ground Floor', 'Mr. Rith', 82),
('WH002', 'Library Store', 'Building B, 1st Floor', 'Ms. Sreyneang', 64),
('WH003', 'Science Lab Store', 'Building C, Lab Wing', 'Mr. Piseth', 41),
('WH004', 'IT Equipment Room', 'Building A, 2nd Floor', 'Ms. Kunthea', 70),
('WH005', 'Cleaning Supply Room', 'Building D, Rear', 'Mr. Makara', 55)
ON CONFLICT (id) DO NOTHING;

-- Suppliers
INSERT INTO public.suppliers (id, company, contact, phone, email, address) VALUES
('SUP01', 'Phnom Penh Stationery Co.', 'Mr. Sokha', '+855 12 345 678', 'sales@ppstationery.com', 'St. 271, Phnom Penh'),
('SUP02', 'Cambodia IT Solutions', 'Ms. Dara', '+855 98 765 432', 'info@camit.com', 'Monivong Blvd, Phnom Penh'),
('SUP03', 'Angkor Furniture Works', 'Mr. Vibol', '+855 11 222 333', 'angkor.furn@mail.com', 'Siem Reap'),
('SUP04', 'Mekong Lab Supplies', 'Dr. Chanthy', '+855 12 888 999', 'orders@mekonglab.com', 'Battambang'),
('SUP05', 'CleanPro Distribution', 'Ms. Srey', '+855 10 555 666', 'cleanpro@mail.com', 'Phnom Penh')
ON CONFLICT (id) DO NOTHING;

-- Departments
INSERT INTO public.departments (id, name, head) VALUES
('D1', 'Primary Department', 'Ms. Bopha'),
('D2', 'Secondary Department', 'Mr. Vichea'),
('D3', 'Science Department', 'Dr. Chanthy'),
('D4', 'IT Department', 'Ms. Kunthea'),
('D5', 'Administration', 'Mr. Rith'),
('D6', 'Sports Department', 'Mr. Makara')
ON CONFLICT (id) DO NOTHING;

-- Inventory Items
INSERT INTO public.items (barcode, name, category_id, brand, unit, cost, price, min_qty, qty, warehouse_id, status) VALUES
('SCH000001', 'Whiteboard Marker', 'C1', 'Snowman', 'Box', 4.50, 5.00, 20, 142, 'WH001', 'Active'),
('SCH000002', 'A4 Copy Paper', 'C1', 'Double A', 'Ream', 3.80, 4.50, 30, 18, 'WH001', 'Active'),
('SCH000003', 'Student Notebook', 'C1', 'Local', 'Pc', 0.60, 1.00, 100, 640, 'WH001', 'Active'),
('SCH000010', 'Dell Latitude Laptop', 'C2', 'Dell', 'Pc', 620.00, 720.00, 2, 7, 'WH004', 'Active'),
('SCH000011', 'Epson Projector EB-X51', 'C2', 'Epson', 'Pc', 390.00, 450.00, 2, 0, 'WH004', 'Out of Stock'),
('SCH000012', 'HP LaserJet Printer', 'C2', 'HP', 'Pc', 180.00, 210.00, 1, 3, 'WH004', 'Active'),
('SCH000020', 'Student Desk (Wood)', 'C3', 'Local', 'Pc', 35.00, 45.00, 10, 8, 'WH001', 'Low Stock'),
('SCH000021', 'Office Chair', 'C3', 'Ergo', 'Pc', 48.00, 60.00, 5, 26, 'WH001', 'Active'),
('SCH000022', 'Steel Cabinet', 'C3', 'Secure', 'Pc', 95.00, 120.00, 3, 11, 'WH001', 'Active'),
('SCH000030', 'Khmer Textbook Gr.7', 'C4', 'MoEYS', 'Pc', 2.20, 0.00, 50, 310, 'WH002', 'Active'),
('SCH000031', 'English Dictionary', 'C4', 'Oxford', 'Pc', 9.00, 0.00, 10, 6, 'WH002', 'Low Stock'),
('SCH000040', 'Microscope Slide Set', 'C5', 'LabPro', 'Set', 22.00, 0.00, 4, 9, 'WH003', 'Active'),
('SCH000041', 'Ethanol 95% (1L)', 'C5', 'ChemCo', 'Bottle', 6.50, 0.00, 5, 2, 'WH003', 'Low Stock'),
('SCH000050', 'Football Size 5', 'C6', 'Molten', 'Pc', 14.00, 0.00, 4, 15, 'WH001', 'Active'),
('SCH000051', 'Volleyball Net', 'C6', 'Molten', 'Pc', 28.00, 0.00, 2, 0, 'WH001', 'Out of Stock'),
('SCH000060', 'Hand Sanitizer 500ml', 'C7', 'LifeBuoy', 'Bottle', 2.10, 0.00, 40, 55, 'WH005', 'Active'),
('SCH000061', 'Tissue Paper Roll', 'C7', 'C&S', 'Roll', 0.90, 0.00, 60, 34, 'WH005', 'Low Stock'),
('SCH000070', 'Ceiling Fan', 'C8', 'Panasonic', 'Pc', 42.00, 0.00, 3, 12, 'WH001', 'Active'),
('SCH000071', 'LED Tube Light', 'C8', 'Philips', 'Pc', 5.20, 0.00, 20, 16, 'WH001', 'Low Stock'),
('SCH000080', 'PVC ID Card Blank', 'C9', 'Hiti', 'Pack', 12.00, 0.00, 10, 44, 'WH001', 'Active'),
('SCH000081', 'ID Card Ribbon (Color)', 'C9', 'Hiti', 'Roll', 18.00, 0.00, 5, 3, 'WH001', 'Low Stock')
ON CONFLICT (barcode) DO NOTHING;

-- Purchases
INSERT INTO public.purchases (id, supplier_id, date, invoice, items_count, total, status) VALUES
('PO-2026-014', 'SUP01', '2026-09-28', 'INV-88213', 4, 412.50, 'Received'),
('PO-2026-013', 'SUP02', '2026-09-25', 'INV-55120', 2, 1830.00, 'Pending'),
('PO-2026-012', 'SUP03', '2026-09-20', 'INV-30921', 6, 1240.00, 'Received'),
('PO-2026-011', 'SUP04', '2026-09-16', 'INV-77410', 3, 386.00, 'Partial'),
('PO-2026-010', 'SUP05', '2026-09-12', 'INV-11802', 5, 214.75, 'Received'),
('PO-2026-009', 'SUP01', '2026-09-05', 'INV-88101', 8, 690.00, 'Received')
ON CONFLICT (id) DO NOTHING;

-- Transactions
INSERT INTO public.transactions (id, item_barcode, item_name, warehouse, type, qty, date, ref, remark) VALUES
('TXN-10241', 'SCH000001', 'Whiteboard Marker', 'Main Store', 'Stock In', 100, '2026-09-28', 'PO-2026-014', 'Purchase received'),
('TXN-10240', 'SCH000002', 'A4 Copy Paper', 'Main Store', 'Stock Out', 20, '2026-09-27', 'ISS-0341', 'Issued to Administration'),
('TXN-10239', 'SCH000021', 'Office Chair', 'Main Store', 'Transfer', 6, '2026-09-26', 'TRF-0092', 'Transfer to Library Store'),
('TXN-10238', 'SCH000060', 'Hand Sanitizer 500ml', 'Cleaning Supply Room', 'Stock In', 60, '2026-09-24', 'PO-2026-010', 'Purchase received'),
('TXN-10237', 'SCH000031', 'English Dictionary', 'Library Store', 'Adjustment', -2, '2026-09-23', 'AUD-0018', 'Damaged during audit'),
('TXN-10236', 'SCH000003', 'Student Notebook', 'Main Store', 'Stock Out', 150, '2026-09-22', 'ISS-0340', 'Issued to Primary Dept'),
('TXN-10235', 'SCH000051', 'Volleyball Net', 'Main Store', 'Return Out', 2, '2026-09-21', 'RET-0007', 'Returned to supplier')
ON CONFLICT (id) DO NOTHING;

-- Requisition Requests
INSERT INTO public.requests (id, dept, item_name, qty, date, requested_by, status) VALUES
('REQ-0341', 'Administration', 'A4 Copy Paper', 20, '2026-09-27', 'Mr. Rith', 'Issued'),
('REQ-0342', 'Science Department', 'Ethanol 95% (1L)', 5, '2026-09-29', 'Dr. Chanthy', 'Pending'),
('REQ-0343', 'Primary Department', 'Whiteboard Marker', 12, '2026-09-30', 'Ms. Bopha', 'Approved'),
('REQ-0344', 'IT Department', 'HP LaserJet Printer', 1, '2026-09-30', 'Ms. Kunthea', 'Pending'),
('REQ-0345', 'Sports Department', 'Football Size 5', 4, '2026-10-01', 'Mr. Makara', 'Pending'),
('REQ-0346', 'Secondary Department', 'Student Notebook', 80, '2026-10-01', 'Mr. Vichea', 'Rejected'),
('REQ-0347', 'Library', 'English Dictionary', 3, '2026-10-02', 'Ms. Sreyneang', 'Returned')
ON CONFLICT (id) DO NOTHING;

-- Audits
INSERT INTO public.audits (id, warehouse, item_name, system_qty, physical_qty, date, status) VALUES
('AUD-0018', 'Library Store', 'English Dictionary', 8, 6, '2026-09-23', 'Adjusted'),
('AUD-0017', 'Main Store', 'A4 Copy Paper', 20, 20, '2026-09-18', 'Matched'),
('AUD-0016', 'Science Lab Store', 'Ethanol 95% (1L)', 4, 2, '2026-09-15', 'Adjusted'),
('AUD-0015', 'Main Store', 'Office Chair', 26, 26, '2026-09-10', 'Matched'),
('AUD-0014', 'IT Equipment Room', 'Dell Latitude Laptop', 7, 8, '2026-09-08', 'Pending')
ON CONFLICT (id) DO NOTHING;

-- Maintenance History
INSERT INTO public.maintenance (id, item_name, date, description, cost, status) VALUES
('MNT-00001', 'Epson Projector EB-X51', '2026-09-20', 'Lamp replaced and lens cleaned', 85.00, 'Completed'),
('MNT-00002', 'Dell Latitude Laptop', '2026-09-24', 'Battery replaced under warranty', 0.00, 'Completed'),
('MNT-00003', 'HP LaserJet Printer', '2026-09-30', 'Toner and pickup roller serviced', 45.50, 'In Progress'),
('MNT-00004', 'Ceiling Fan', '2026-10-03', 'Bearing lubrication scheduled', 12.00, 'Scheduled'),
('MNT-00005', 'Office Chair', '2026-09-18', 'Gas lift and casters repaired', 9.75, 'Completed')
ON CONFLICT (id) DO NOTHING;

-- Company Settings (single row; the Settings screen is the editor)
INSERT INTO public.company_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

