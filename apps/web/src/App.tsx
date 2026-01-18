import { BrowserRouter, Route, Routes } from 'react-router-dom';
import EditorPage from './EditorPage';
import './App.css';

function App() {
  // Get base path from PUBLIC_URL, ensure no trailing slash for React Router
  const publicUrl = process.env.PUBLIC_URL || '';
  // React Router basename should not have trailing slash
  const basename = publicUrl ? (publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl) : '/';

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/display/:readonlyDiagramId" element={<EditorPage />} />
        <Route path="/edit/:editDiagramId" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
