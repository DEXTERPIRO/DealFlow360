import React from 'react';
import { Card } from '../components/ui/Card';

export default function GenericPage({ title = "Page" }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
      </div>
      <Card className="p-6">
        <p className="text-slate-400">Loading {title} module...</p>
      </Card>
    </div>
  );
}
