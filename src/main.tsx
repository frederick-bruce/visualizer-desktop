import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import './index.css'
import App from './App'
import Home from './routes/Home'
import Dashboard from './routes/Dashboard'
import Callback from './routes/Callback'


const router = createBrowserRouter([
{
path: '/',
element: <App />,
children: [
	{ index: true, element: <Dashboard /> },
	{ path: 'home', element: <Home /> },
	{ path: 'dashboard', element: <Dashboard /> },
	{ path: 'callback', element: <Callback /> },
]
},
])


ReactDOM.createRoot(document.getElementById('root')!).render(
<React.StrictMode>
	<ErrorBoundary>
		<RouterProvider router={router} />
	</ErrorBoundary>
</React.StrictMode>
)