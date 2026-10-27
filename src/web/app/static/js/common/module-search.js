const MODULE_SEARCH_TABLE_IDS = [
  'productsTableBody',
  'categoriesTableBody',
  'clientsTableBody',
  'settingsPermissionsTableBody',
  'settingsProfilesTableBody',
  'settingsUsersTableBody',
  'clientProductsTableBody',
];

function setupModuleSearch() {
  const wrapper = document.getElementById('moduleSearchWrapper');
  const input = document.getElementById('moduleSearchInput');
  if (!wrapper || !input) return;

  const targetId = MODULE_SEARCH_TABLE_IDS.find((id) => document.getElementById(id));
  if (!targetId) {
    wrapper.remove();
    return;
  }

  const tableBody = document.getElementById(targetId);
  const applyFilter = () => {
    const term = input.value.trim().toLowerCase();
    Array.from(tableBody.rows).forEach((row) => {
      row.style.display = !term || row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  };

  input.addEventListener('input', applyFilter);
  new MutationObserver(applyFilter).observe(tableBody, { childList: true });
}
