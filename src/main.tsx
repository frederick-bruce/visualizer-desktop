import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import Home from './routes/Home'
import Callback from './routes/Callback'


const router = createBrowserRouter([
{
path: '/',
element: <App />,
children: [
{ index: true, element: <Home /> },
{ path: 'callback', element: <Callback /> },
]
},
])


ReactDOM.createRoot(document.getElementById('root')!).render(
<React.StrictMode>
<RouterProvider router={router} />
</React.StrictMode>
)