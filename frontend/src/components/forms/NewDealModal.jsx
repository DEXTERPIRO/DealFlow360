import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useDealStore } from '../../store/dealStore';
import { dealApi } from '../../api/dealApi';
import toast from 'react-hot-toast';

export const NewDealModal = () => {
  const { isNewDealModalOpen, setIsNewDealModalOpen, addOrUpdateDeal } = useDealStore();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    targetCompany: '',
    industry: '',
    dealValue: '',
    stage: 'LEAD',
    priority: 'MEDIUM',
    probability: 25,
    description: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.targetCompany) {
      toast.error('Please specify both Deal Title and Target Company');
      return;
    }

    setLoading(true);
    try {
      const res = await dealApi.createDeal({
        ...formData,
        dealValue: Number(formData.dealValue) || 0,
        probability: Number(formData.probability) || 20,
      });

      addOrUpdateDeal(res.data);
      toast.success('Deal Mandate created successfully!');
      setIsNewDealModalOpen(false);
      setFormData({
        title: '',
        targetCompany: '',
        industry: '',
        dealValue: '',
        stage: 'LEAD',
        priority: 'MEDIUM',
        probability: 25,
        description: '',
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create deal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isNewDealModalOpen}
      onClose={() => setIsNewDealModalOpen(false)}
      title="Create New Deal Mandate"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Deal Title"
          name="title"
          placeholder="e.g. Acquisition of Apex Technologies"
          value={formData.title}
          onChange={handleChange}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Target Company"
            name="targetCompany"
            placeholder="e.g. Apex Tech Inc"
            value={formData.targetCompany}
            onChange={handleChange}
            required
          />
          <Input
            label="Industry / Sector"
            name="industry"
            placeholder="e.g. SaaS & AI"
            value={formData.industry}
            onChange={handleChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Deal Valuation (USD)"
            name="dealValue"
            type="number"
            placeholder="e.g. 50000000"
            value={formData.dealValue}
            onChange={handleChange}
          />
          <div>
            <label className="block text-xs font-heading font-extrabold uppercase tracking-wider text-slate-900 mb-1.5">
              Priority
            </label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="w-full rounded-xl bg-white border-2 border-slate-900 text-slate-900 text-xs font-heading font-bold px-3.5 py-2.5 focus:shadow-pop focus:outline-none transition-all"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-heading font-extrabold uppercase tracking-wider text-slate-900 mb-1.5">
            Initial Pipeline Stage
          </label>
          <select
            name="stage"
            value={formData.stage}
            onChange={handleChange}
            className="w-full rounded-xl bg-white border-2 border-slate-900 text-slate-900 text-xs font-heading font-bold px-3.5 py-2.5 focus:shadow-pop focus:outline-none transition-all"
          >
            <option value="LEAD">Lead Inflow</option>
            <option value="QUALIFICATION">Qualification</option>
            <option value="DUE_DILIGENCE">Due Diligence</option>
            <option value="NEGOTIATION">Negotiation</option>
            <option value="CLOSED_WON">Closed Won</option>
            <option value="CLOSED_LOST">Closed Lost</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-heading font-extrabold uppercase tracking-wider text-slate-900 mb-1.5">
            Investment Thesis / Summary
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="Brief overview of transaction structure and core strategic rationale..."
            value={formData.description}
            onChange={handleChange}
            className="w-full rounded-xl bg-white border-2 border-slate-900 text-slate-900 placeholder:text-slate-400 text-xs font-heading font-medium p-3 focus:shadow-pop focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-slate-900">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsNewDealModalOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading} variant="primary">
            {loading ? 'Creating Mandate...' : 'Create Mandate'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
