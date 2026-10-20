import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import NewInspection from './pages/NewInspection';
import Inspections from './pages/Inspections';
import InspectionDetail from './pages/InspectionDetail';
import Defects from './pages/Defects';
import PriorityQueue from './pages/PriorityQueue';
import QualityIntelligence from './pages/QualityIntelligence';
import Users from './pages/Users';

function Spinner() {
  return (
    <div className="flex justify-center items-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/batches/:id" element={<BatchDetail />} />
            <Route path="/inspections/new" element={<NewInspection />} />
            <Route path="/inspections" element={<Inspections />} />
            <Route path="/inspections/:id" element={<InspectionDetail />} />
            <Route path="/defects" element={<Defects />} />
            <Route path="/priority-queue" element={<PriorityQueue />} />
            <Route path="/quality-ai" element={<QualityIntelligence />} />
            <Route path="/users" element={<Users />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
