# Unsaved Changes Protection

## Overview

The capacity planner now includes protection against data loss when users try to leave the page with unsaved changes.

## Features

### 1. **Browser Navigation Protection**

- **Browser Refresh**: Shows native browser confirmation dialog
- **Tab Closing**: Shows native browser confirmation dialog
- **URL Navigation**: Shows native browser confirmation dialog
- **Message**: "You have unsaved changes. Are you sure you want to leave?"

### 2. **Angular Router Protection**

- **Route Navigation**: Shows PrimeNG confirmation dialog
- **Three Options**:
  - **Save & Leave**: Saves changes and then navigates away
  - **Leave Without Saving**: Discards changes and navigates away
  - **Cancel**: Stays on current page

### 3. **Visual Indicators**

- **Unsaved Changes Warning**: Red warning text with exclamation icon appears when there are unsaved changes
- **Save Button State**: Disabled when no changes, enabled when changes detected
- **Location**: Below the Save button

### 4. **Smart Detection**

The system detects unsaved changes by monitoring:

- `changedMainTableCells` Set (main table modifications)
- `changedCTBCells` Set (CTB table modifications)

## Implementation Details

### Component Methods:

- `hasUnsavedChanges()`: Returns true if any changes exist
- `canDeactivate()`: Angular router guard method
- `saveDataAndLeave()`: Saves data before navigation
- `clearChangeTracking()`: Clears all change tracking

### Event Handlers:

- `@HostListener('window:beforeunload')`: Handles browser navigation
- PrimeNG ConfirmDialog: Handles Angular route changes

### User Experience:

1. **Make Changes**: User modifies data in either table
2. **Visual Feedback**: Warning indicator appears
3. **Leave Attempt**: User tries to navigate away
4. **Protection**: Confirmation dialog appears
5. **User Choice**: Save, discard, or cancel
6. **Safe Navigation**: Data is protected from loss

## Benefits:

✅ **Data Loss Prevention**: No accidental loss of user work  
✅ **User-Friendly**: Clear options and messaging  
✅ **Smart Detection**: Only triggers when actual changes exist  
✅ **Flexible Options**: User can save, discard, or stay  
✅ **Visual Feedback**: Clear indication of unsaved state

## Technical Components Added:

- ConfirmDialogModule (PrimeNG)
- ConfirmationService (PrimeNG)
- HostListener decorator
- Change detection methods
- Save-and-leave workflow
