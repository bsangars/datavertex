function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function buildSeed(now = new Date()) {
  const workers = [
    { id: 1, name: 'Avery Chen', department: 'Operations', manager: 'Morgan Blake', start_date: addDays(now, 3), status: 'approved', location: 'San Francisco' },
    { id: 2, name: 'Jordan Lee', department: 'Sales', manager: 'Riley Park', start_date: addDays(now, 5), status: 'approved', location: 'Austin' },
    { id: 3, name: 'Sam Rivera', department: 'Engineering', manager: 'Casey Wu', start_date: addDays(now, 7), status: 'approved', location: 'Remote' },
    { id: 4, name: 'Taylor Brooks', department: 'Finance', manager: 'Dana Ortiz', start_date: addDays(now, 10), status: 'approved', location: 'Chicago' },
    { id: 5, name: 'Quinn Patel', department: 'Sales', manager: 'Riley Park', start_date: addDays(now, 12), status: 'approved', location: 'New York' },
    { id: 6, name: 'Morgan Ellis', department: 'Operations', manager: 'Morgan Blake', start_date: addDays(now, 14), status: 'approved', location: 'Denver' },
    { id: 7, name: 'Jamie Fox', department: 'Marketing', manager: 'Alex Kim', start_date: addDays(now, 16), status: 'approved', location: 'Remote' },
    { id: 8, name: 'Riley Nguyen', department: 'Engineering', manager: 'Casey Wu', start_date: addDays(now, 18), status: 'approved', location: 'Seattle' },
    { id: 9, name: 'Drew Coleman', department: 'Sales', manager: 'Riley Park', start_date: addDays(now, 20), status: 'approved', location: 'Boston' },
    { id: 10, name: 'Casey Hart', department: 'People', manager: 'Dana Ortiz', start_date: addDays(now, 22), status: 'approved', location: 'San Francisco' },
    { id: 11, name: 'Alex Morgan', department: 'Operations', manager: 'Morgan Blake', start_date: addDays(now, 25), status: 'approved', location: 'Austin' },
    { id: 12, name: 'Skyler Reed', department: 'Finance', manager: 'Dana Ortiz', start_date: addDays(now, 28), status: 'approved', location: 'Chicago' }
  ];

  const onboardingTasks = [
    { id: 1, worker_id: 1, task_name: 'IT-access acknowledgement', status: 'pending' },
    { id: 2, worker_id: 1, task_name: 'Benefits enrollment', status: 'complete' },
    { id: 3, worker_id: 2, task_name: 'IT-access acknowledgement', status: 'pending' },
    { id: 4, worker_id: 2, task_name: 'Benefits enrollment', status: 'pending' },
    { id: 5, worker_id: 3, task_name: 'Equipment assignment', status: 'complete' },
    { id: 6, worker_id: 4, task_name: 'Benefits enrollment', status: 'pending' },
    { id: 7, worker_id: 5, task_name: 'IT-access acknowledgement', status: 'pending' },
    { id: 8, worker_id: 7, task_name: 'Background check confirmation', status: 'complete' },
    { id: 9, worker_id: 9, task_name: 'Benefits enrollment', status: 'pending' },
    { id: 10, worker_id: 9, task_name: 'IT-access acknowledgement', status: 'pending' },
    { id: 11, worker_id: 11, task_name: 'Equipment assignment', status: 'complete' },
    { id: 12, worker_id: 12, task_name: 'Benefits enrollment', status: 'complete' }
  ];

  const accounts = [
    { id: 1, name: 'Northwind Logistics', industry: 'Transportation', region: 'West', owner: 'Jordan Lee' },
    { id: 2, name: 'Summit Health', industry: 'Healthcare', region: 'East', owner: 'Quinn Patel' },
    { id: 3, name: 'Brightline Retail', industry: 'Retail', region: 'Central', owner: 'Drew Coleman' },
    { id: 4, name: 'Atlas Manufacturing', industry: 'Manufacturing', region: 'West', owner: 'Jordan Lee' },
    { id: 5, name: 'Harbor Finance Group', industry: 'Financial Services', region: 'East', owner: 'Quinn Patel' },
    { id: 6, name: 'Pioneer Energy', industry: 'Energy', region: 'South', owner: 'Drew Coleman' }
  ];

  const opportunities = [
    { id: 1, account_id: 1, name: 'West fleet optimization', stage: 'Negotiation', amount: 420000, close_date: addDays(now, 18), owner: 'Jordan Lee', probability: 75 },
    { id: 2, account_id: 2, name: 'Clinical workflow rollout', stage: 'Proposal', amount: 310000, close_date: addDays(now, 25), owner: 'Quinn Patel', probability: 55 },
    { id: 3, account_id: 3, name: 'Omnichannel analytics', stage: 'Discovery', amount: 180000, close_date: addDays(now, 35), owner: 'Drew Coleman', probability: 30 },
    { id: 4, account_id: 4, name: 'Plant operations suite', stage: 'Closed Won', amount: 560000, close_date: addDays(now, -12), owner: 'Jordan Lee', probability: 100 },
    { id: 5, account_id: 5, name: 'Risk reporting platform', stage: 'Negotiation', amount: 275000, close_date: addDays(now, 14), owner: 'Quinn Patel', probability: 70 },
    { id: 6, account_id: 6, name: 'Field service expansion', stage: 'Proposal', amount: 195000, close_date: addDays(now, 21), owner: 'Drew Coleman', probability: 45 },
    { id: 7, account_id: 1, name: 'Renewal — logistics core', stage: 'Closed Won', amount: 890000, close_date: addDays(now, -5), owner: 'Jordan Lee', probability: 100 },
    { id: 8, account_id: 3, name: 'Store rollout phase 2', stage: 'Negotiation', amount: 340000, close_date: addDays(now, 9), owner: 'Drew Coleman', probability: 80 },
    { id: 9, account_id: 2, name: 'Patient intake pilot', stage: 'Closed Lost', amount: 120000, close_date: addDays(now, -20), owner: 'Quinn Patel', probability: 0 },
    { id: 10, account_id: 5, name: 'Compliance dashboard', stage: 'Discovery', amount: 150000, close_date: addDays(now, 40), owner: 'Quinn Patel', probability: 25 }
  ];

  const documents = [
    { id: 1, title: 'New Starter Onboarding Checklist', status: 'approved', owner: 'People Operations' },
    { id: 2, title: 'IT Access Acknowledgement', status: 'approved', owner: 'IT' },
    { id: 3, title: 'Benefits Enrollment Guide', status: 'approved', owner: 'People Operations' },
    { id: 4, title: 'Manager Onboarding Playbook', status: 'approved', owner: 'People Operations' }
  ];

  const metrics = [
    { metric: 'fulfillment_cost', region: 'West', value: 18.42, plan_value: 17.02, period: 'current month', expedited_orders: 17 },
    { metric: 'fulfillment_cost', region: 'East', value: 15.88, plan_value: 16.10, period: 'current month', expedited_orders: 9 },
    { metric: 'fulfillment_cost', region: 'Central', value: 16.55, plan_value: 16.40, period: 'current month', expedited_orders: 6 }
  ];

  const articles = [
    {
      title: 'Hybrid Work Policy',
      version: '4.2',
      status: 'published',
      excerpt: 'Managers may approve up to three remote days per week when role requirements permit.'
    }
  ];

  return { workers, onboardingTasks, accounts, opportunities, documents, metrics, articles };
}
