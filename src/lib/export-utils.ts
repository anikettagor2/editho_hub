
export function downloadCSV(data: any[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        const escaped = ('' + (val ?? '')).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ];

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function formatProjectForExport(projects: any[]) {
  return projects.map(p => ({
    'Project ID': p.id,
    'Name': p.name,
    'Client': p.clientName || p.brand || 'N/A',
    'Status': p.status,
    'Video Type': p.videoType || 'N/A',
    'Video Format': p.videoFormat || 'N/A',
    'Budget': p.budget || 0,
    'Total Cost': p.totalCost || 0,
    'Amount Paid': p.amountPaid || 0,
    'Payment Status': p.paymentStatus || 'N/A',
    'Assigned Editor ID': p.assignedEditorId || 'Unassigned',
    'Created At': p.createdAt ? new Date(p.createdAt).toLocaleString() : 'N/A',
    'Completed At': p.completedAt ? new Date(p.completedAt).toLocaleString() : 'N/A'
  }));
}

export function formatUserForExport(users: any[]) {
  return users.map(u => ({
    'UID': u.uid,
    'Display Name': u.displayName || 'N/A',
    'Email': u.email || 'N/A',
    'Role': u.role,
    'Status': u.status || 'active',
    'Phone': u.phoneNumber || u.whatsappNumber || 'N/A',
    'Company': u.companyName || 'N/A',
    'Created At': u.createdAt ? new Date(u.createdAt).toLocaleString() : 'N/A'
  }));
}
