# HyperMart

A SaaS + Marketplace platform for local shops to manage inventory, billing, and get discovered by nearby customers.

## Features

- **Shop Management**: Tools for local shop owners to manage their inventory, billing, and sales.
- **Marketplace**: A platform for customers to discover and order from nearby shops.
- **Inventory Control**: Comprehensive stock management, including stock adjustment with pagination.
- **Billing System**: Easy-to-use billing for walk-in customers.
- **Real-time Updates**: Powered by Firebase for instant data synchronization.

## Recent Updates

### 2026-04-08
- **Order & Billing Enhancements**:
  - **Comprehensive Order Details**: Updated the "Orders" tab to display a full breakdown of subtotal, item discounts, bill discounts, and total discounts for better transparency.
  - **Billing Tab "Add Product"**: Integrated an "Add Product" button directly into the Billing tab for quick inventory updates during the billing process.
  - **Offer Management**:
    - **Edit/Delete Offers**: Added full CRUD support for both Product and Bill Value offers, allowing shop owners to easily modify or remove active promotions.
    - **Duplicate Prevention**: Implemented a smart warning system that detects and flags duplicate offers for the same product or bill value, preventing redundant discounts.
- **UI/UX Refinements**:
  - **Consistent Styling**: Standardized the "Add Product" button size across the Billing and Inventory tabs for a more cohesive user experience.
  - **Visual Feedback**: Improved the display of savings in both owner and customer order views.

### 2026-04-06
- **Inventory Management Enhancements**:
  - **Duplicate Product Prevention**: Implemented a robust check to prevent adding products with the same name and unit to the inventory.
  - **Advanced Filtering & Sorting**: Added category-based filtering and multiple sorting options (Price, Stock, Newest) to the Product Catalog.
  - **Improved Form UX**: Replaced standard alerts with inline status messages and automatic form closing after successful additions.
- **Billing System Improvements**:
  - **Duplicate Item Check**: The billing system now warns users if they try to add the same product multiple times to a single bill, suggesting quantity updates instead.
  - **Visual Feedback**: Added checkmark indicators and specific styling for products already included in the current bill.
  - **Order Tracking**: Enhanced the billing history with clearer "Online" vs "Walk-in" tagging and improved search/filter capabilities.
- **Admin Panel Enhancements**:
  - **Owners Management**: Added a dedicated "Owners" tab to separate owner management from the general user list.
  - **Multi-Location Requests**: Implemented a pulsing amber indicator for pending multi-location access requests.
  - **Responsive Tabs**: Tab headers are now horizontally scrollable and fully responsive for mobile devices.
- **Owner Dashboard & Reporting**:
  - **Real-time Reports**: Introduced a "Reports" tab with "Today Sales" and "Online vs Walk-in" analysis.
  - **Interactive Stats**: Dashboard metrics (Sales, Orders, Products) are now clickable shortcuts to the Reports and Inventory sections.
  - **Total Products Sold**: Added a new metric to track the total quantity of items sold across all channels.
- **Billing & Inventory**:
  - **Atomic Stock Reduction**: Implemented Firestore's `increment` operation for reliable, real-time stock updates during billing.
  - **Walk-in Tagging**: In-store bills are now automatically tagged as "walk-in" for accurate sales reporting.
- **Mobile Navigation**:
  - **Functional Bottom Bar**: Shop owners now have a dedicated bottom navigation bar for quick access to Stats, Stock, and Orders.
  - **State Sync**: Bottom navigation is perfectly synchronized with the main dashboard tabs.
- **Infrastructure**:
  - **Firestore Reliability**: Resolved connection issues and added a boot-time connection test.
  - **Responsive Footer**: Updated the global footer with a 4-column desktop and 2-column mobile layout.

### 2026-04-04
- **Catalog Search**: Added a search bar in the Product Catalog to help shop owners quickly find products by name or category.
- **Inventory UI Cleanup**: Removed 'Master' and 'Product' sub-items from the 'Stock' menu in the Inventory Manager to streamline the interface.
- **Shop Ratings and Reviews**: Customers can now view shop ratings and review counts on shop cards. They can also read detailed reviews and submit their own ratings and comments for any shop.
- **Stock Adjustment Pagination**: Added pagination to the Stock Adjustment module to handle large inventories efficiently.
- **Logo Navigation Fix**: Updated the HyperMart logo in the header to consistently reset the app state and navigate users back to their primary overview page.
- **Dashboard Resets**: Improved navigation logic to ensure shop owners return to the main "Stats" tab when clicking "Home" or the brand logo.
- **Z-Index Improvements**: Fixed an issue where the logo was sometimes unclickable due to dropdown overlays.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion, Lucide React
- **Backend**: Firebase (Firestore, Authentication)
- **Build Tool**: Vite
