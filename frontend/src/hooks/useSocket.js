import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useDealStore } from '../store/dealStore';

export const useSocket = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const addOrUpdateDeal = useDealStore((state) => state.addOrUpdateDeal);
  const removeDeal = useDealStore((state) => state.removeDeal);

  useEffect(() => {
    // In dev, connect to port 5000 or relative proxy
    const socket = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket.io Client] Connected with ID:', socket.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket.io Client] Disconnected');
    });

    socket.on('deal:created', (deal) => {
      addOrUpdateDeal(deal);
      toast.success(`New Deal Added: ${deal.title}`);
    });

    socket.on('deal:updated', (deal) => {
      addOrUpdateDeal(deal);
      toast(`Deal Updated: ${deal.title}`);
    });

    socket.on('deal:deleted', ({ id }) => {
      removeDeal(id);
      toast.error('Deal was removed');
    });

    return () => {
      socket.disconnect();
    };
  }, [addOrUpdateDeal, removeDeal]);

  const joinDealRoom = (dealId) => {
    if (socketRef.current) {
      socketRef.current.emit('join:deal', dealId);
    }
  };

  const leaveDealRoom = (dealId) => {
    if (socketRef.current) {
      socketRef.current.emit('leave:deal', dealId);
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    joinDealRoom,
    leaveDealRoom,
  };
};
