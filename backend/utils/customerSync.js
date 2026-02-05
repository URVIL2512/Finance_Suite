import Customer from '../models/Customer.js';
import Invoice from '../models/Invoice.js';

/**
 * Sync customer data to all invoices for a specific customer
 * This ensures all invoices reflect the latest customer information
 */
export const syncCustomerDataToInvoices = async (customerId, userId) => {
  try {
    console.log('🔄 Starting customer data sync for customer:', customerId);
    
    // Get the latest customer data
    const customer = await Customer.findOne({
      _id: customerId,
      user: userId,
      isActive: { $ne: false }
    }).lean();
    
    if (!customer) {
      console.log('❌ Customer not found for sync:', customerId);
      return { success: false, message: 'Customer not found' };
    }
    
    // Find all invoices for this customer
    const invoices = await Invoice.find({
      $or: [
        { 'clientDetails.name': customer.displayName },
        { 'clientDetails.name': customer.clientName },
        { clientEmail: customer.email }
      ],
      user: userId
    });
    
    console.log(`📋 Found ${invoices.length} invoices to sync for customer: ${customer.displayName || customer.clientName}`);
    
    if (invoices.length === 0) {
      return { success: true, message: 'No invoices found to sync', invoicesUpdated: 0 };
    }
    
    // Update all invoices with latest customer data
    const updatePromises = invoices.map(invoice => 
      Invoice.findByIdAndUpdate(invoice._id, {
        'clientDetails.pan': customer.pan || '',
        'clientDetails.gstNo': customer.gstNo || '',
        'clientDetails.gstin': customer.gstin || customer.gstNo || '',
        'clientDetails.placeOfSupply': customer.placeOfSupply || '',
        'clientDetails.state': customer.billingAddress?.state || customer.state || '',
        'clientDetails.country': customer.billingAddress?.country || customer.country || '',
        'clientDetails.address': customer.billingAddress?.street1 || '',
        'clientDetails.city': customer.billingAddress?.city || '',
        'clientDetails.pincode': customer.billingAddress?.pinCode || ''
      })
    );
    
    await Promise.all(updatePromises);
    
    console.log(`✅ Successfully synced customer data to ${invoices.length} invoices`);
    
    return {
      success: true,
      message: `Customer data synced to ${invoices.length} invoices`,
      invoicesUpdated: invoices.length,
      customerName: customer.displayName || customer.clientName
    };
    
  } catch (error) {
    console.error('❌ Error syncing customer data to invoices:', error);
    return {
      success: false,
      message: 'Failed to sync customer data',
      error: error.message
    };
  }
};

/**
 * Sync customer data to invoices when customer is updated
 * This is called automatically when a customer is updated
 */
export const autoSyncCustomerData = async (customerId, userId) => {
  try {
    // Run sync in background without blocking the response
    setImmediate(async () => {
      const result = await syncCustomerDataToInvoices(customerId, userId);
      if (result.success) {
        console.log(`🔄 Auto-sync completed: ${result.message}`);
      } else {
        console.error(`❌ Auto-sync failed: ${result.message}`);
      }
    });
    
    return { success: true, message: 'Auto-sync initiated' };
  } catch (error) {
    console.error('❌ Error initiating auto-sync:', error);
    return { success: false, message: 'Failed to initiate auto-sync' };
  }
};