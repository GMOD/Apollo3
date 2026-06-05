export const apolloDataGridSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 3,
  backgroundColor: 'background.paper',
  overflow: 'hidden',
  '& .MuiDataGrid-toolbarContainer': {
    padding: '10px 12px',
    borderBottom: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'grey.50',
  },
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: 'grey.100',
    borderBottom: '1px solid',
    borderColor: 'divider',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontWeight: 700,
    color: 'text.primary',
    letterSpacing: '0.01em',
  },
  '& .MuiDataGrid-columnSeparator': {
    color: 'divider',
  },
  '& .MuiDataGrid-cell': {
    alignItems: 'center',
    borderColor: 'divider',
    borderBottomColor: 'divider',
  },
  '& .MuiDataGrid-row:nth-of-type(even)': {
    backgroundColor: 'grey.50',
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'action.hover',
  },
  '& .MuiDataGrid-footerContainer': {
    borderTop: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'grey.50',
  },
} as const
