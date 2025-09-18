import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import './index.css'
import App from './App'
import Callback from './routes/Callback'


const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/callback', element: <Callback /> },
])


ReactDOM.createRoot(document.getElementById('root')!).render(
<React.StrictMode>
	<ErrorBoundary>
		<RouterProvider router={router} />
	</ErrorBoundary>
</React.StrictMode>
)