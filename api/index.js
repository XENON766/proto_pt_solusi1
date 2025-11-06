// api/index.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, query, body } = req;
  const { endpoint, type, id } = query;

  try {
    switch (endpoint) {
      case 'orders':
        return await handleOrders(req, res, method, id, body);
      case 'dashboard':
        return await handleDashboard(req, res, method);
      case 'tracking':
        return await handleTracking(req, res, method, id, body);
      case 'dss':
        return await handleDSS(req, res, method, id);
      case 'efficiency':
        return await handleEfficiency(req, res, method, body);
      case 'export':
        return await handleExport(req, res, method);
      case 'health':
        return res.status(200).json({ status: 'ok' });
      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

// ==================== Helper Functions ====================
async function getFromKV(key) {
  try {
    const data = await kv.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting from KV:', error);
    return null;
  }
}

async function setToKV(key, value) {
  try {
    await kv.set(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Error setting to KV:', error);
    return false;
  }
}

async function deleteFromKV(key) {
  try {
    await kv.del(key);
    return true;
  } catch (error) {
    console.error('Error deleting from KV:', error);
    return false;
  }
}

// Production processes definition
const productionProcesses = [
  { id: 'warehouse_in', name: 'Gudang Masuk', icon: 'fa-box' },
  { id: 'sanding', name: 'Amplas', icon: 'fa-sandpaper' },
  { id: 'assembly', name: 'Perakitan', icon: 'fa-tools' },
  { id: 'coloring', name: 'Pewarnaan', icon: 'fa-fill-drip' },
  { id: 'accessories', name: 'Aksesoris', icon: 'fa-puzzle-piece', optional: true },
  { id: 'welding', name: 'Las', icon: 'fa-fire', optional: true },
  { id: 'inspection', name: 'Inspeksi', icon: 'fa-search' },
  { id: 'coating', name: 'Pelapisan', icon: 'fa-layer-group' },
  { id: 'packaging', name: 'Packaging & Kode', icon: 'fa-box-open' },
  { id: 'warehouse_out', name: 'Gudang Akhir', icon: 'fa-warehouse' }
];

// Default efficiency settings
const defaultEfficiencySettings = {
  warehouse_in: { targetTime: 2, targetQuality: 99, targetOutput: 100 },
  sanding: { targetTime: 4, targetQuality: 95, targetOutput: 90 },
  assembly: { targetTime: 6, targetQuality: 97, targetOutput: 95 },
  coloring: { targetTime: 3, targetQuality: 98, targetOutput: 92 },
  accessories: { targetTime: 2, targetQuality: 96, targetOutput: 94 },
  welding: { targetTime: 5, targetQuality: 95, targetOutput: 88 },
  inspection: { targetTime: 1, targetQuality: 100, targetOutput: 100 },
  coating: { targetTime: 4, targetQuality: 97, targetOutput: 90 },
  packaging: { targetTime: 2, targetQuality: 99, targetOutput: 98 },
  warehouse_out: { targetTime: 1, targetQuality: 100, targetOutput: 100 }
};

// Initialize default data
async function initializeData() {
  try {
    const orders = await getFromKV('orders');
    const settings = await getFromKV('efficiency_settings');

    if (!orders || orders.length === 0) {
      const defaultOrders = [
        {
          order_id: 'ORD-001',
          customer_name: 'PT Maju Jaya',
          product_description: 'Meja Kerja Kayu',
          quantity: 5,
          order_date: '2023-10-01',
          target_date: '2023-10-20',
          pic_name: 'Budi Santoso',
          current_status: 'in_progress',
          notes: 'Prioritas tinggi',
          requires_accessories: true,
          requires_welding: false,
          progress: 40,
          risk_level: 'MEDIUM',
          risk_score: 60,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tracking: productionProcesses.map(process => ({
            process: process.id,
            status: 'pending',
            quantity_completed: 0,
            defect_quantity: 0,
            start_time: null,
            end_time: null,
            pic_name: '',
            issues: '',
            last_updated: null
          }))
        },
        {
          order_id: 'ORD-002',
          customer_name: 'CV Sejahtera',
          product_description: 'Kursi Kantor',
          quantity: 10,
          order_date: '2023-10-05',
          target_date: '2023-10-25',
          pic_name: 'Siti Rahayu',
          current_status: 'in_progress',
          notes: 'Warna hitam doff',
          requires_accessories: false,
          requires_welding: true,
          progress: 20,
          risk_level: 'HIGH',
          risk_score: 75,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tracking: productionProcesses.map(process => ({
            process: process.id,
            status: 'pending',
            quantity_completed: 0,
            defect_quantity: 0,
            start_time: null,
            end_time: null,
            pic_name: '',
            issues: '',
            last_updated: null
          }))
        }
      ];
      await setToKV('orders', defaultOrders);
    }

    if (!settings) {
      await setToKV('efficiency_settings', defaultEfficiencySettings);
    }
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}

// ==================== Orders Handler ====================
async function handleOrders(req, res, method, id, body) {
  try {
    await initializeData();
    let orders = await getFromKV('orders') || [];

    switch (method) {
      case 'GET':
        if (id) {
          const order = orders.find(o => o.order_id === id);
          return order ? res.status(200).json(order) : res.status(404).json({ error: 'Order not found' });
        }
        return res.status(200).json(orders);

      case 'POST':
        const newOrder = {
          order_id: `ORD-${String(orders.length + 1).padStart(3, '0')}`,
          customer_name: body.customer_name,
          product_description: body.product_description,
          quantity: parseInt(body.quantity),
          order_date: body.order_date,
          target_date: body.target_date,
          pic_name: body.pic_name,
          current_status: 'pending',
          notes: body.notes || '',
          requires_accessories: body.requires_accessories || false,
          requires_welding: body.requires_welding || false,
          progress: 0,
          risk_level: 'LOW',
          risk_score: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tracking: productionProcesses.map(process => ({
            process: process.id,
            status: 'pending',
            quantity_completed: 0,
            defect_quantity: 0,
            start_time: null,
            end_time: null,
            pic_name: '',
            issues: '',
            last_updated: null
          }))
        };

        orders.push(newOrder);
        await setToKV('orders', orders);
        return res.status(201).json(newOrder);

      case 'PUT':
        if (!id) return res.status(400).json({ error: 'Order ID required' });

        const updateIndex = orders.findIndex(o => o.order_id === id);
        if (updateIndex === -1) return res.status(404).json({ error: 'Order not found' });

        orders[updateIndex] = {
          ...orders[updateIndex],
          ...body,
          order_id: id,
          updated_at: new Date().toISOString()
        };

        await setToKV('orders', orders);
        return res.status(200).json(orders[updateIndex]);

      case 'DELETE':
        if (!id) return res.status(400).json({ error: 'Order ID required' });

        const deleteIndex = orders.findIndex(o => o.order_id === id);
        if (deleteIndex === -1) return res.status(404).json({ error: 'Order not found' });

        orders.splice(deleteIndex, 1);
        await setToKV('orders', orders);
        return res.status(200).json({ message: 'Order deleted successfully' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in handleOrders:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ==================== Dashboard Handler ====================
async function handleDashboard(req, res, method) {
  try {
    if (method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    await initializeData();
    const orders = await getFromKV('orders') || [];

    // Calculate KPIs
    const totalOrders = orders.length;
    const inProgressOrders = orders.filter(o => o.current_status === 'in_progress').length;
    const completedOrders = orders.filter(o => o.current_status === 'completed').length;
    const criticalOrders = orders.filter(o => o.risk_level === 'CRITICAL').length;

    const avgProgress = orders.length > 0 ? (orders.reduce((sum, o) => sum + o.progress, 0) / orders.length) : 0;
    const avgRiskScore = orders.length > 0 ? (orders.reduce((sum, o) => sum + o.risk_score, 0) / orders.length) : 0;

    // Calculate defect rate
    let totalDefects = 0;
    let totalQuantity = 0;
    orders.forEach(order => {
      order.tracking.forEach(track => {
        totalDefects += track.defect_quantity;
        totalQuantity += order.quantity;
      });
    });
    const defectRate = totalQuantity > 0 ? ((totalDefects / totalQuantity) * 100).toFixed(2) : 0;

    // Get at-risk orders
    const atRiskOrders = orders.filter(o => o.risk_level === 'CRITICAL' || o.risk_level === 'HIGH');

    // Detect bottleneck
    const bottleneck = detectBottleneck(orders);

    const dashboard = {
      kpi: {
        total_orders: totalOrders,
        in_progress: inProgressOrders,
        completed: completedOrders,
        critical_orders: criticalOrders,
        avg_progress: avgProgress.toFixed(1),
        avg_risk_score: avgRiskScore.toFixed(1),
        defect_rate: defectRate,
        avg_lead_time: 48
      },
      at_risk_orders: atRiskOrders,
      bottleneck: bottleneck
    };

    return res.status(200).json(dashboard);
  } catch (error) {
    console.error('Error in handleDashboard:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ==================== Tracking Handler ====================
async function handleTracking(req, res, method, id, body) {
  try {
    if (!id) return res.status(400).json({ error: 'Order ID required' });

    await initializeData();
    let orders = await getFromKV('orders') || [];

    const orderIndex = orders.findIndex(o => o.order_id === id);
    if (orderIndex === -1) return res.status(404).json({ error: 'Order not found' });

    const order = orders[orderIndex];

    switch (method) {
      case 'GET':
        return res.status(200).json(order.tracking);

      case 'PUT':
        const { process, quantity_completed, defect_quantity, pic_name, start_time, end_time, issues } = body;

        if (!process) return res.status(400).json({ error: 'Process ID required' });

        const trackingIndex = order.tracking.findIndex(t => t.process === process);
        if (trackingIndex === -1) return res.status(404).json({ error: 'Process not found' });

        // Update tracking
        order.tracking[trackingIndex] = {
          ...order.tracking[trackingIndex],
          quantity_completed: parseInt(quantity_completed) || 0,
          defect_quantity: parseInt(defect_quantity) || 0,
          start_time: start_time || order.tracking[trackingIndex].start_time,
          end_time: end_time || order.tracking[trackingIndex].end_time,
          pic_name: pic_name || '',
          issues: issues || '',
          last_updated: new Date().toISOString()
        };

        // Update status based on quantity
        if (quantity_completed === 0) {
          order.tracking[trackingIndex].status = 'pending';
        } else if (parseInt(quantity_completed) === order.quantity) {
          order.tracking[trackingIndex].status = 'completed';
          if (!end_time) {
            order.tracking[trackingIndex].end_time = new Date().toISOString();
          }
        } else {
          order.tracking[trackingIndex].status = 'in_progress';
        }

        // Update order status and progress
        updateOrderStatus(order);
        order.updated_at = new Date().toISOString();

        // Recalculate risk
        const riskAssessment = calculateRiskAssessment(order);
        order.risk_level = riskAssessment.risk_level;
        order.risk_score = riskAssessment.risk_score;

        orders[orderIndex] = order;
        await setToKV('orders', orders);

        return res.status(200).json(order);

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in handleTracking:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ==================== DSS (Decision Support System) Handler ====================
async function handleDSS(req, res, method, id) {
  try {
    if (method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    await initializeData();
    const orders = await getFromKV('orders') || [];

    if (id) {
      // Single order analysis
      const order = orders.find(o => o.order_id === id);
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const riskAssessment = calculateRiskAssessment(order);
      const processEfficiency = calculateProcessEfficiency(order);

      const analysis = {
        order_id: order.order_id,
        customer: order.customer_name,
        risk_assessment: riskAssessment,
        process_efficiency: processEfficiency,
        progress: order.progress,
        recommendations: generateRecommendations(order, riskAssessment)
      };

      return res.status(200).json(analysis);
    } else {
      // Combined analysis
      const totalOrders = orders.length;
      const completedOrders = orders.filter(o => o.current_status === 'completed').length;
      const inProgressOrders = orders.filter(o => o.current_status === 'in_progress').length;

      const avgProgress = orders.length > 0 ? (orders.reduce((sum, o) => sum + o.progress, 0) / orders.length) : 0;
      const avgRiskScore = orders.length > 0 ? (orders.reduce((sum, o) => sum + o.risk_score, 0) / orders.length) : 0;

      const processEfficiencyAll = calculateCombinedProcessEfficiency(orders);
      const bottlenecks = analyzeBottlenecks(orders);

      const analysis = {
        summary: {
          total_orders: totalOrders,
          completed: completedOrders,
          in_progress: inProgressOrders,
          avg_progress: avgProgress.toFixed(1),
          avg_risk_score: avgRiskScore.toFixed(1)
        },
        process_efficiency: processEfficiencyAll,
        bottlenecks: bottlenecks,
        recommendations: generateCombinedRecommendations(avgRiskScore, bottlenecks)
      };

      return res.status(200).json(analysis);
    }
  } catch (error) {
    console.error('Error in handleDSS:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ==================== Efficiency Handler ====================
async function handleEfficiency(req, res, method, body) {
  try {
    await initializeData();

    switch (method) {
      case 'GET':
        const settings = await getFromKV('efficiency_settings') || defaultEfficiencySettings;
        return res.status(200).json(settings);

      case 'PUT':
        await setToKV('efficiency_settings', body);
        return res.status(200).json(body);

      case 'DELETE':
        await setToKV('efficiency_settings', defaultEfficiencySettings);
        return res.status(200).json({ message: 'Reset to default', settings: defaultEfficiencySettings });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in handleEfficiency:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ==================== Export Handler ====================
async function handleExport(req, res, method) {
  try {
    if (method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    await initializeData();
    const orders = await getFromKV('orders') || [];
    const settings = await getFromKV('efficiency_settings') || defaultEfficiencySettings;

    const exportData = {
      orders,
      efficiency_settings: settings,
      exported_at: new Date().toISOString(),
      total_orders: orders.length,
      summary: {
        completed: orders.filter(o => o.current_status === 'completed').length,
        in_progress: orders.filter(o => o.current_status === 'in_progress').length,
        pending: orders.filter(o => o.current_status === 'pending').length
      }
    };

    return res.status(200).json(exportData);
  } catch (error) {
    console.error('Error in handleExport:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ==================== Calculation Functions ====================

function updateOrderStatus(order) {
  const applicableProcesses = productionProcesses.filter(process => {
    if (process.optional) {
      if (process.id === 'accessories') return order.requires_accessories;
      if (process.id === 'welding') return order.requires_welding;
    }
    return true;
  });

  const completedProcesses = applicableProcesses.filter(process => {
    const tracking = order.tracking.find(t => t.process === process.id);
    return tracking && tracking.quantity_completed === order.quantity;
  }).length;

  order.progress = Math.round((completedProcesses / applicableProcesses.length) * 100);

  const warehouseOut = order.tracking.find(t => t.process === 'warehouse_out');
  if (warehouseOut && warehouseOut.quantity_completed === order.quantity) {
    order.current_status = 'completed';
  } else if (order.tracking.some(t => t.quantity_completed > 0)) {
    order.current_status = 'in_progress';
  } else {
    order.current_status = 'pending';
  }
}

function calculateRiskAssessment(order) {
  const today = new Date();
  const targetDate = new Date(order.target_date);
  const orderDate = new Date(order.order_date);

  const daysUntilDue = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
  const daysSinceOrder = Math.ceil((today - orderDate) / (1000 * 60 * 60 * 24));
  const totalDaysAllocated = Math.ceil((targetDate - orderDate) / (1000 * 60 * 60 * 24));

  const timeUsedRatio = totalDaysAllocated > 0 ? daysSinceOrder / totalDaysAllocated : 0;
  const timePressure = Math.max(0, Math.min(100, (timeUsedRatio - (order.progress / 100)) * 100));

  const progressRisk = 100 - order.progress;

  const totalDefects = order.tracking.reduce((sum, process) => sum + process.defect_quantity, 0);
  const defectRate = order.quantity > 0 ? (totalDefects / order.quantity) * 100 : 0;
  const defectRisk = Math.min(100, defectRate * 10);

  let bottleneckRisk = 0;
  const completedProcesses = order.tracking.filter(p => p.quantity_completed === order.quantity).length;
  const expectedProcesses = Math.ceil((order.progress / 100) * order.tracking.length);
  if (completedProcesses < expectedProcesses - 2) {
    bottleneckRisk = 50;
  }

  const finalRiskScore = Math.min(100,
    (progressRisk * 0.4) +
    (timePressure * 0.3) +
    (defectRisk * 0.2) +
    (bottleneckRisk * 0.1)
  );

  let riskLevel;
  if (finalRiskScore >= 80 || daysUntilDue < 0) {
    riskLevel = 'CRITICAL';
  } else if (finalRiskScore >= 60) {
    riskLevel = 'HIGH';
  } else if (finalRiskScore >= 40) {
    riskLevel = 'MEDIUM';
  } else if (finalRiskScore >= 20) {
    riskLevel = 'LOW';
  } else {
    riskLevel = 'VERY LOW';
  }

  if (daysSinceOrder < 2 && order.progress === 0) {
    riskLevel = 'LOW';
  }

  return {
    risk_level: riskLevel,
    risk_score: Math.round(finalRiskScore),
    days_until_due: daysUntilDue,
    time_pressure: Math.round(timePressure),
    defect_rate: defectRate.toFixed(2)
  };
}

function calculateProcessEfficiency(order) {
  const efficiency = {};

  productionProcesses.forEach(process => {
    const tracking = order.tracking.find(t => t.process === process.id);

    if (tracking && tracking.start_time && tracking.end_time) {
      const start = new Date(tracking.start_time);
      const end = new Date(tracking.end_time);
      const actualTime = (end - start) / (1000 * 60 * 60);

      const quality = Math.max(0, 100 - ((tracking.defect_quantity / order.quantity) * 100));
      const output = (tracking.quantity_completed / order.quantity) * 100;

      // Weighted calculation: time (40%), quality (40%), output (20%)
      efficiency[process.id] = Math.min(100, (actualTime ? (2 / actualTime) * 100 * 0.4 : 0) + (quality * 0.4) + (output * 0.2));
    } else if (tracking && tracking.quantity_completed > 0) {
      efficiency[process.id] = 50; // In progress
    } else {
      efficiency[process.id] = 0;
    }
  });

  return efficiency;
}

function calculateCombinedProcessEfficiency(orders) {
  const efficiency = {};

  productionProcesses.forEach(process => {
    let totalEfficiency = 0;
    let count = 0;

    orders.forEach(order => {
      const tracking = order.tracking.find(t => t.process === process.id);

      if (tracking && tracking.start_time && tracking.end_time) {
        const start = new Date(tracking.start_time);
        const end = new Date(tracking.end_time);
        const actualTime = (end - start) / (1000 * 60 * 60);

        const quality = Math.max(0, 100 - ((tracking.defect_quantity / order.quantity) * 100));
        const output = (tracking.quantity_completed / order.quantity) * 100;

        totalEfficiency += Math.min(100, (actualTime ? (2 / actualTime) * 100 * 0.4 : 0) + (quality * 0.4) + (output * 0.2));
        count++;
      }
    });

    efficiency[process.id] = count > 0 ? totalEfficiency / count : 0;
  });

  return efficiency;
}

function detectBottleneck(orders) {
  const slowProcesses = {};

  orders.forEach(order => {
    order.tracking.forEach(process => {
      if (process.start_time && process.end_time) {
        const start = new Date(process.start_time);
        const end = new Date(process.end_time);
        const duration = (end - start) / (1000 * 60 * 60);

        if (!slowProcesses[process.process] || duration > slowProcesses[process.process].duration) {
          slowProcesses[process.process] = { duration, count: 1 };
        } else {
          slowProcesses[process.process].count++;
        }
      }
    });
  });

  let bottleneck = { workstation: 'None', avg_duration: 0, risk_level: 'LOW' };

  for (const [process, data] of Object.entries(slowProcesses)) {
    const avgDuration = data.duration / data.count;
    if (avgDuration > bottleneck.avg_duration) {
      const processName = productionProcesses.find(p => p.id === process)?.name || process;
      bottleneck = {
        workstation: processName,
        avg_duration: avgDuration.toFixed(1),
        risk_level: avgDuration > 8 ? 'HIGH' : 'MEDIUM'
      };
    }
  }

  return bottleneck;
}

function analyzeBottlenecks(orders) {
  const delays = {};

  productionProcesses.forEach(process => {
    let totalDelay = 0;
    let count = 0;

    orders.forEach(order => {
      const tracking = order.tracking.find(t => t.process === process.id);

      if (tracking && tracking.start_time && tracking.end_time) {
        const start = new Date(tracking.start_time);
        const end = new Date(tracking.end_time);
        const duration = (end - start) / (1000 * 60 * 60);

        const expectedDuration = defaultEfficiencySettings[process.id]?.targetTime || 2;
        const delay = Math.max(0, duration - expectedDuration);

        totalDelay += delay;
        count++;
      }
    });

    delays[process.id] = count > 0 ? totalDelay / count : 0;
  });

  return delays;
}

function generateRecommendations(order, riskAssessment) {
  const recommendations = [];

  if (riskAssessment.risk_level === 'CRITICAL') {
    recommendations.push({
      priority: 'HIGH',
      action: 'Immediate intervention required. Allocate additional resources to meet deadline.'
    });
  }

  if (riskAssessment.days_until_due < 3) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Deadline approaching. Consider overtime or temporary workforce.'
    });
  }

  if (order.progress < 30 && riskAssessment.time_pressure > 50) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Progress is behind schedule. Review process bottlenecks.'
    });
  }

  if (parseFloat(riskAssessment.defect_rate) > 5) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'High defect rate detected. Improve quality control measures.'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'LOW',
      action: 'Order is on track. Continue monitoring progress.'
    });
  }

  return recommendations;
}

function generateCombinedRecommendations(avgRiskScore, bottlenecks) {
  const recommendations = [];

  if (avgRiskScore > 70) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Overall risk is high. Review all critical orders and allocate resources accordingly.'
    });
  }

  let maxDelay = 0;
  let bottleneckProcess = '';

  for (const [process, delay] of Object.entries(bottlenecks)) {
    if (delay > maxDelay) {
      maxDelay = delay;
      bottleneckProcess = process;
    }
  }

  if (maxDelay > 4) {
    const processName = productionProcesses.find(p => p.id === bottleneckProcess)?.name || bottleneckProcess;
    recommendations.push({
      priority: 'HIGH',
      action: `Significant bottleneck detected at ${processName}. Average delay: ${maxDelay.toFixed(1)} hours. Consider increasing workforce or optimizing workflow.`
    });
  } else if (maxDelay > 2) {
    const processName = productionProcesses.find(p => p.id === bottleneckProcess)?.name || bottleneckProcess;
    recommendations.push({
      priority: 'MEDIUM',
      action: `Moderate bottleneck at ${processName}. Monitor closely and consider process optimization.`
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'LOW',
      action: 'Production is running smoothly. Continue current operations and maintain quality standards.'
    });
  }

  return recommendations;
}
