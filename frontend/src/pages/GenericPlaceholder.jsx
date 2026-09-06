import React from 'react';
import { Card } from '../components/ui/Card';

export default function GenericPage({ title = "Page" }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-extrabold text-slate-900">{title}</h1>
      </div>
      <Card className="p-6 border-2 border-slate-900 shadow-pop bg-white rounded-3xl">
        <p className="text-slate-600 font-medium">Loading {title} module...</p>
      </Card>
    </div>
  );
}
