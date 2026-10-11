import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './Theme'
import './index.css'
import './practice.css'
import './image-composer.css'
import './exam.css'
import './exam-dark.css'
import './app-theme.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider><App /></ThemeProvider>
  </React.StrictMode>,
)
