# Profile Components Integration Guide

## Overview
Three new profile-related components have been created for the HyperMart application:

1. **OwnerProfile.jsx** - Shop owner profile management
2. **AdminProfileManagement.jsx** - Admin user management dashboard
3. **UserProfileView.jsx** - Public/read-only user profile viewer

## Files Created

### 1. OwnerProfile.jsx
**Location:** `frontend/src/pages/OwnerProfile.jsx`

**Purpose:** Allows shop owners to view and edit their profile information.

**Features:**
- Profile photo upload with preview
- Edit name, phone, email (read-only), and business name
- Real-time form validation
- Toast notifications for user feedback
- Loading states and error handling
- Logout button

**Usage:**
```jsx
import OwnerProfile from './pages/OwnerProfile';

// In your router/navigation
<Route path="/profile" component={OwnerProfile} />

// Or with hash routing
href="/#/owner-profile"
```

**Dependencies:**
- `motion/react` - Animations
- `lucide-react` - Icons
- `../api/client` - API calls (`updateMe`, `uploadFile`)
- `../context/AppContext` - User context
- `../hooks/useTranslation` - i18n support

### 2. AdminProfileManagement.jsx
**Location:** `frontend/src/pages/AdminProfileManagement.jsx`

**Purpose:** Admin dashboard for managing all user profiles and roles.

**Features:**
- Search users by name, email, or business name
- View all users in a searchable table with:
  - User name
  - Email
  - Business name
  - Role badge (Admin, Owner, Buyer)
- Actions:
  - View user details
  - Edit user profile
  - Delete user
- Edit modal for changing user data and roles
- View modal for detailed user information
- Role assignment (buyer, owner, admin)

**Usage:**
```jsx
import AdminProfileManagement from './pages/AdminProfileManagement';

// In your router
<Route path="/admin/users" component={AdminProfileManagement} />

// Or Hash routing
href="/#/admin/users"
```

**API Endpoints Required:**
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

**Dependencies:**
- `motion/react` - Animations
- `lucide-react` - Icons
- `../api/client` - API calls
- `../context/AppContext` - Authentication context
- `../hooks/useTranslation` - i18n support

### 3. UserProfileView.jsx
**Location:** `frontend/src/pages/UserProfileView.jsx`

**Purpose:** Public/read-only profile view for viewing other users' profiles.

**Features:**
- Display user profile with photo
- Show contact information (email, phone, location)
- Display seller rating and review count (for shop owners)
- Status badges (Verified seller, Email verified)
- Member since date and bio
- Business name for shop owners
- Actions:
  - Send message to user
  - Block/unblock user
- Graceful error handling for unavailable profiles

**Usage:**
```jsx
import UserProfileView from './pages/UserProfileView';

// In your router
<Route path="/user/:userId" component={UserProfileView} />

// When calling the component with userId
<UserProfileView userId={userId} />

// Or Hash routing
href="/#/user/123"
```

**Props:**
- `userId` (required) - The ID of the user whose profile to display

**API Endpoints Required:**
- `GET /api/users/:id` - Get user profile
- `GET /api/users/:currentUserId/blocked` - Get blocked users list
- `POST /api/users/block/:userId` - Block user
- `POST /api/users/block/:userId` with `{unblock: true}` - Unblock user

**Dependencies:**
- `motion/react` - Animations
- `lucide-react` - Icons
- `../api/client` - API calls
- `../context/AppContext` - User context
- `../hooks/useTranslation` - i18n support

## Translation Keys Added

The following translation keys have been added to all locale files:

### Profile Section Additions
- `profile.userProfile` - "User Profile"

### New Admin Section
- `admin.userManagement` - User Management page title
- `admin.searchUsers` - Search placeholder text
- `admin.addUser` - Add user button
- `admin.editUser` - Edit user modal title
- `admin.deleteUser` - Delete user action
- `admin.viewDetails` - View details action
- `admin.userDeleted` - Success message
- `admin.deleteConfirm` - Delete confirmation text
- `admin.userRole` - User role field label
- `admin.userStatus` - User status field label
- `admin.businessName` - Business name field label
- `admin.verified` - Verified status badge
- `admin.notVerified` - Not verified status badge

**Available in languages:**
- English (en)
- Hindi (hi)
- Telugu (te)

## Router Integration

### Example Route Configuration

```jsx
// In your App.jsx or router configuration
import OwnerProfile from './pages/OwnerProfile';
import AdminProfileManagement from './pages/AdminProfileManagement';
import UserProfileView from './pages/UserProfileView';

const routes = [
  {
    path: 'owner-profile',
    component: OwnerProfile,
    protected: true,
    requiredRole: 'owner'
  },
  {
    path: 'admin/users',
    component: AdminProfileManagement,
    protected: true,
    requiredRole: 'admin'
  },
  {
    path: 'user/:userId',
    component: UserProfileView,
    protected: false // Can be viewed by anyone
  }
];
```

### Hash Routing (if using)

```jsx
// Navigation examples
<a href="/#/owner-profile">My Profile</a>
<a href="/#/admin/users">User Management</a>
<a href={`/#/user/${userId}`}>View Profile</a>
```

## API Integration Checklist

### OwnerProfile.jsx Requires:
- [ ] `PUT /api/users/me` - Update current user profile
- [ ] `POST /api/upload` - Upload profile photo (or similar endpoint)

### AdminProfileManagement.jsx Requires:
- [ ] `GET /api/users` - List all users with pagination
- [ ] `GET /api/users/:id` - Get single user details
- [ ] `PUT /api/users/:id` - Update user (role, profile details)
- [ ] `DELETE /api/users/:id` - Delete user account

### UserProfileView.jsx Requires:
- [ ] `GET /api/users/:id` - Get user profile (public data)
- [ ] `GET /api/users/:currentUserId/blocked` - Get blocked users list
- [ ] `POST /api/users/block/:userId` - Block a user
- [ ] `POST /api/users/block/:userId` with body `{unblock: true}` - Unblock user

## Styling Notes

All components use:
- **Tailwind CSS 4.1.17** with custom color scheme:
  - Primary: `#5A5A40` (brown/olive)
  - Background: `#F5F5F0` (light beige)
  - Text: `#1A1A1A` (dark)
  - Borders: `#1A1A1A/5` or `#1A1A1A/10`

- **Radix UI** for accessible components
- **Lucide React** for icons
- **Motion/React** for animations
- **Responsive design** with `sm:` breakpoints

## Component State Management

### OwnerProfile.jsx
```javascript
{
  loading: boolean,        // API call in progress
  editing: boolean,        // Edit mode toggle
  toast: string | null,    // Toast message
  form: {
    display_name: string,
    email: string,
    phone: string,
    shop_name: string
  },
  preview: string          // Image preview URL
}
```

### AdminProfileManagement.jsx
```javascript
{
  users: User[],           // All users from API
  filteredUsers: User[],   // Filtered search results
  search: string,          // Search input
  loading: boolean,        // API call in progress
  editing: string | null,  // User ID being edited
  viewing: User | null,    // User being viewed
  toast: string | null,    // Toast message
  form: User               // Form data for editing
}
```

### UserProfileView.jsx
```javascript
{
  user: User | null,       // User profile data
  loading: boolean,        // API call in progress
  error: string | null,    // Error message
  isBlocked: boolean       // Whether current user blocked this user
}
```

## Error Handling

All components include:
- Graceful error messages
- Loading states
- Toast notifications for user feedback
- Fallback UI for missing data
- Try-catch error handling for API calls

## Security Considerations

1. **OwnerProfile.jsx:**
   - Only allows editing own profile (uses `updateMe` endpoint)
   - Contact support to change email (read-only field)
   - Validates file type and size for photos

2. **AdminProfileManagement.jsx:**
   - Role-based access control (admin only)
   - Delete confirmation dialog
   - Cannot edit own role (recommended backend validation)

3. **UserProfileView.jsx:**
   - Shows only public profile data
   - User can block/unblock other users
   - No sensitive data exposed
   - Cannot modify other user data

## Testing Recommendations

### OwnerProfile.jsx
- [ ] Test profile photo upload with various file sizes
- [ ] Test form validation (required fields)
- [ ] Test API error handling
- [ ] Test responsive design on mobile

### AdminProfileManagement.jsx
- [ ] Test user search functionality
- [ ] Test edit user modal with all roles
- [ ] Test delete with confirmation
- [ ] Test pagination (if large user count)
- [ ] Test permission check (admin only)

### UserProfileView.jsx
- [ ] Test loading state
- [ ] Test error state for non-existent user
- [ ] Test block/unblock functionality
- [ ] Test with seller (owner) vs buyer profiles
- [ ] Test messaging functionality (when implemented)

## Future Enhancements

1. **OwnerProfile:**
   - Add social media links
   - Add business hours/availability
   - Add shop statistics/analytics

2. **AdminProfileManagement:**
   - Add bulk user operations
   - Add user audit log
   - Add email verification management
   - Add suspension/ban feature

3. **UserProfileView:**
   - Add review/rating display
   - Add messaging system integration
   - Add report user functionality
   - Add user verification badges

## Troubleshooting

### "Failed to update profile"
- Check API endpoint is correct
- Verify authentication token
- Check backend validation
- Review network tab in DevTools

### "Translation key not found"
- Ensure translation JSON files are updated
- Clear browser cache
- Verify key structure matches (e.g., `admin.userManagement`)

### "API undefined"
- Import API client: `import { api } from '../api/client'`
- Verify client configuration in `src/api/client.js`

### Components not rendering
- Check route configuration
- Verify component import paths
- Check if user has required role/permissions
- Review console for errors

## Additional Notes

- All components follow the existing HyperMart design system
- Consistent with other pages (Marketplace, OwnerDashboard, AdminPanel)
- Uses hooks for state management (no Redux required)
- Fully responsive and mobile-friendly
- Supports multiple languages (en, hi, te)
- Full accessibility support via Radix UI

---

**Last Updated:** January 2024
**Version:** 1.0.0
