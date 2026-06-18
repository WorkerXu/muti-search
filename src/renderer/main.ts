import './styles.css';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing #app root element');
}

root.innerHTML = '<main class="app-shell"><h1>muti-search</h1></main>';
