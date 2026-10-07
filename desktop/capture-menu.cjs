function captureMenu(sources, mode, select, selectArea, cancel) {
  const displays = sources.filter(source => source.id.startsWith('screen:'));
  const windows = sources.filter(source => source.id.startsWith('window:'));
  const items = [];
  if (mode !== 'window') {
    items.push({ label: 'Desktop · tela inteira', enabled: false });
    displays.forEach((source, index) => items.push({ label: displays.length === 1 ? 'Desktop' : `Desktop ${index + 1}`, click: () => select(source) }));
  }
  if (mode === 'choose' || mode === 'window') {
    if (items.length) items.push({ type: 'separator' });
    items.push({ label: 'Janelas abertas', enabled: false });
    windows.forEach(source => items.push({ label: source.name, click: () => select(source) }));
    if (!windows.length) items.push({ label: 'Nenhuma janela disponível', enabled: false });
  }
  if (mode !== 'window') {
    items.push({ type: 'separator' });
    items.push(displays.length === 1
      ? { label: 'Selecionar área…', click: () => selectArea(displays[0]) }
      : { label: 'Selecionar área…', submenu: displays.map((source, index) => ({ label: `Desktop ${index + 1}`, click: () => selectArea(source) })) });
  }
  items.push({ type: 'separator' }, { label: 'Cancelar', click: cancel });
  return items;
}
module.exports = { captureMenu };
