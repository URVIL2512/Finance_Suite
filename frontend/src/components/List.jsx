import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { invoiceAPI, customerAPI, itemAPI, settingsAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import ConfirmationModal from './ConfirmationModal';
import MobileSelect from './MobileSelect';

// Indian States List
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const InvoiceForm = ({ invoice, customers = [], onSubmit, onCancel, onCustomerAdded, onRedirectToCustomer, pendingCustomerSelect, onCustomerSelected }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [existingItems, setExistingItems] = useState([]);
  const [hsnSacCodes, setHsnSacCodes] = useState([]); // kept for backward compatibility; now unused
  const [hsnSacSearchTerm, setHsnSacSearchTerm] = useState({});
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [gstRates, setGstRates] = useState([]);
  const [tdsRates, setTdsRates] = useState([]);
  const [tcsRates, setTcsRates] = useState([]);
  const [showAddGstModal, setShowAddGstModal] = useState(false);
  const [showAddTdsModal, setShowAddTdsModal] = useState(false);
  const [showAddTcsModal, setShowAddTcsModal] = useState(false);
  const [newRateValue, setNewRateValue] = useState('');
  const [openGstDropdown, setOpenGstDropdown] = useState(false);
  const [openTdsDropdown, setOpenTdsDropdown] = useState(false);
  const [openTcsDropdown, setOpenTcsDropdown] = useState(false);
  const gstDropdownRef = useRef(null);
  const tdsDropdownRef = useRef(null);
  const tcsDropdownRef = useRef(null);
  const autoCreateTimeoutRef = useRef({});
  const lastLoadedInvoiceIdRef = useRef(null); // Track last loaded invoice ID to prevent resetting items
  const isLoadingInvoiceRef = useRef(false); // Prevent multiple simultaneous loads
  const [deleteAllItemsConfirm, setDeleteAllItemsConfirm] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState({ show: false, itemId: null });
  const [newCustomerData, setNewCustomerData] = useState({
    clientName: '',
    billingAddress: '',
    gstin: '',
    state: '',
    country: 'India',
    email: '',
    mobile: '',
    hsnOrSac: '',
    currency: 'INR',
  });
  const [formData, setFormData] = useState({
    invoiceDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    clientName: '',
    clientAddress: '',
    clientCity: '',
    clientPincode: '',
    clientGstin: '',
    clientState: '',
    placeOfSupply: '',
    gstNo: '',
    clientCountry: 'India',
    clientEmail: '',
    clientMobile: '',
    hsnSac: '',
    currency: 'INR',
    exchangeRate: '',
    notes: '',
    baseAmount: '',
    gstPercentage: '',
    tdsPercentage: '',
    tcsPercentage: '',
    remittanceCharges: '',
    status: 'Unpaid',
  });
  const [items, setItems] = useState([
    {
      id: Date.now(),
      name: '',
      hsnSac: '',
      description: '',
      quantity: 1,
      rate: 0,
      discount: 0,
      amount: 0,
    },
  ]);

  // Load invoice data if editing
  useEffect(() => {
    if (invoice && invoice._id) {
      // PREVENT MULTIPLE API CALLS - Single execution per invoice
      if (isLoadingInvoiceRef.current) {
        console.log('🚫 Invoice loading already in progress, skipping...');
        return;
      }
      
      // Check if this is the same invoice we already loaded
      const isSameInvoice = lastLoadedInvoiceIdRef.current === invoice._id;
      
      if (isSameInvoice) {
        console.log('✅ Same invoice already loaded, preserving existing state');
        return;
      }
      
      // Set loading flag to prevent multiple executions
      isLoadingInvoiceRef.current = true;
      
      try {
        console.log('📝 Loading invoice data for editing:', invoice._id);
        console.log('📝 Full invoice object:', JSON.stringify(invoice, null, 2));
        console.log('📝 Client Details:', invoice.clientDetails);
        console.log('📝 Client Details type:', typeof invoice.clientDetails);
        console.log('📝 Client Details keys:', invoice.clientDetails ? Object.keys(invoice.clientDetails) : 'null/undefined');
        console.log('📝 Client Details full content:', JSON.stringify(invoice.clientDetails, null, 2));
        console.log('📝 Client Email (top level):', invoice.clientEmail);
        console.log('📝 Client Mobile (top level):', invoice.clientMobile);
        console.log('📝 Client Email (from clientDetails):', invoice.clientDetails?.email);
        console.log('📝 Client Mobile (from clientDetails):', invoice.clientDetails?.mobile);
        
        const invoiceDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
        const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        // Get baseAmount from various possible locations
        const baseAmountValue = invoice.amountDetails?.baseAmount ?? 
                                invoice.subTotal ?? 
                                invoice.items?.[0]?.amount ?? 
                                invoice.items?.[0]?.rate ?? 
                                0;
        
        // Get numeric values, handling 0 and undefined/null
        const gstPercent = invoice.gstPercentage ?? 0;
        const tdsPercent = invoice.tdsPercentage ?? 0;
        const tcsPercent = invoice.tcsPercentage ?? 0;
        const remittance = invoice.remittanceCharges ?? 0;
        const exchangeRateValue = invoice.currencyDetails?.exchangeRate ?? invoice.exchangeRate ?? 1;
        
        // Extract client details with proper fallbacks - be very explicit
        const clientDetails = invoice.clientDetails || {};
        
        // Log the actual values to debug
        console.log('🔍 Debugging clientDetails extraction:');
        console.log('  - clientDetails.name:', clientDetails.name);
        console.log('  - clientDetails.email:', clientDetails.email);
        console.log('  - clientDetails.mobile:', clientDetails.mobile);
        console.log('  - clientDetails.address:', clientDetails.address);
        console.log('  - clientDetails.gstin:', clientDetails.gstin);
        console.log('  - clientDetails.state:', clientDetails.state);
        console.log('  - invoice.clientEmail:', invoice.clientEmail);
        console.log('  - invoice.clientMobile:', invoice.clientMobile);
        
        const clientState = clientDetails.state || invoice.clientState || '';
        const clientMobile = invoice.clientMobile || clientDetails.mobile || '';
        const exchangeRate = exchangeRateValue && exchangeRateValue !== 1 ? String(exchangeRateValue) : '';
        const clientCountry = clientDetails.country || invoice.clientCountry || 'India';
        const isIndianClient = clientCountry === 'India';
        
        // Extract all client details fields explicitly - try multiple possible field names
        const clientName = clientDetails.name || 
                          clientDetails.clientName || 
                          invoice.clientName || 
                          invoice.clientDetails?.name || 
                          '';
        const clientAddress = clientDetails.address || 
                             clientDetails.billingAddress || 
                             invoice.clientAddress || 
                             '';
        const clientCity = clientDetails.city || 
                          invoice.clientDetails?.city || 
                          invoice.clientCity || 
                          '';
        const clientPincode = clientDetails.pinCode || 
                             clientDetails.pincode || 
                             invoice.clientDetails?.pincode || 
                             invoice.clientPincode || 
                             '';
        const clientGstin = clientDetails.gstin || 
                           clientDetails.gstin || 
                           invoice.clientGstin || 
                           '';
        const placeOfSupply = clientDetails.placeOfSupply || 
                            invoice.placeOfSupply || 
                            '';
        const gstNo = clientDetails.gstNo || 
                     invoice.gstNo || 
                     '';
        // Try multiple possible locations for email
        const clientEmail = invoice.clientEmail || 
                           clientDetails.email || 
                           clientDetails.clientEmail || 
                           invoice.clientDetails?.email || 
                           '';
        // Try multiple possible locations for mobile
        const clientMobileValue = invoice.clientMobile || 
                                 clientDetails.mobile || 
                                 clientDetails.clientMobile || 
                                 invoice.clientDetails?.mobile || 
                                 '';
        
        console.log('📋 Extracted client data:', {
          clientName,
          clientEmail,
          clientMobile: clientMobileValue,
          clientAddress,
          clientGstin,
          clientState,
          placeOfSupply,
          gstNo,
          clientCountry,
        });
        
        const formDataToSet = {
          invoiceDate: format(invoiceDate, 'yyyy-MM-dd'),
          dueDate: format(dueDate, 'yyyy-MM-dd'),
          clientName: clientName,
          clientAddress: clientAddress,
          clientCity: clientCity,
          clientPincode: clientPincode,
          clientGstin: clientGstin,
          clientState: clientState,
          placeOfSupply: placeOfSupply,
          gstNo: gstNo,
          clientCountry: clientCountry,
          clientEmail: clientEmail,
          clientMobile: clientMobileValue,
          hsnSac: invoice.items?.[0]?.hsnSac || '',
          currency: invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR',
          exchangeRate: exchangeRate,
          notes: invoice.notes || '',
          baseAmount: baseAmountValue > 0 ? String(baseAmountValue) : '',
          gstPercentage: isIndianClient && gstPercent > 0 ? String(gstPercent) : '',
          tdsPercentage: isIndianClient && tdsPercent > 0 ? String(tdsPercent) : '',
          tcsPercentage: isIndianClient && tcsPercent > 0 ? String(tcsPercent) : '',
          remittanceCharges: remittance > 0 ? String(remittance) : '',
          status: invoice.status || 'Unpaid',
        };
        
        console.log('📝 Setting form data:', formDataToSet);
        console.log('📝 Form data client fields check:', {
          clientName: formDataToSet.clientName,
          clientEmail: formDataToSet.clientEmail,
          clientMobile: formDataToSet.clientMobile,
          clientAddress: formDataToSet.clientAddress,
          clientGstin: formDataToSet.clientGstin,
          clientState: formDataToSet.clientState,
        });
        
        // CLEAR STATE BEFORE LOADING - Prevent any cached/duplicate items
        console.log('🧹 Clearing existing items state before loading invoice items');
        setItems([]); // Clear array first
        
        // Force set formData - use a function to ensure it's set correctly
        setFormData(() => {
          console.log('✅ FormData state setter called with:', formDataToSet);
          return formDataToSet;
        });
        
        // LOAD ONLY SAVED INVOICE ITEMS - No auto-additions, no defaults
        console.log('🔄 Loading ONLY saved items from invoice database');
        if (invoice.items && invoice.items.length > 0) {
          // Filter out only truly empty items (no name AND no description AND no amount)
          const validItems = invoice.items.filter(item => {
            const hasName = item.name && item.name.trim() !== '';
            const hasDescription = item.description && item.description.trim() !== '';
            const hasAmount = item.amount && item.amount > 0;
            const hasRate = item.rate && item.rate > 0;
            
            // Keep item if it has any meaningful data
            return hasName || hasDescription || hasAmount || hasRate;
          });
          
          console.log('📋 Valid items found:', validItems.length, 'out of', invoice.items.length);
          
          if (validItems.length > 0) {
            // Create unique IDs to prevent duplicates
            const uniqueItems = validItems.map((item, index) => ({
              id: `invoice-${invoice._id}-item-${index}-${Date.now()}`, // Unique ID based on invoice
              name: item.name || item.description || `Item ${index + 1}`, // Use name first, fallback to description, then default
              hsnSac: item.hsnSac || '',
              description: (item.name && item.description) ? item.description : '', // Only show description if name exists separately
              quantity: Number(item.quantity) || 1,
              rate: Number(item.rate) || 0,
              discount: 0, // Discount not in current schema, default to 0
              amount: Number(item.amount) || 0,
            }));
            
            console.log('✅ Setting items from database:', uniqueItems);
            setItems(uniqueItems);
          } else {
            // If no valid items, set one empty row for editing
            console.log('⚠️ No valid items found, setting one empty row');
            setItems([{
              id: `new-item-${Date.now()}`,
              name: '',
              hsnSac: '',
              description: '',
              quantity: 1,
              rate: 0,
              discount: 0,
              amount: 0,
            }]);
          }
        } else {
          // If invoice has no items, set one empty row
          console.log('📝 Invoice has no items, setting one empty row');
          setItems([{
            id: `new-item-${Date.now()}`,
            name: '',
            hsnSac: '',
            description: '',
            quantity: 1,
            rate: 0,
            discount: 0,
            amount: 0,
          }]);
        }
        
        // Update the ref to track this invoice
        lastLoadedInvoiceIdRef.current = invoice._id;
        
        // Clear loading flag
        isLoadingInvoiceRef.current = false;
        
        // Don't try to match customer here - that will be done in a separate useEffect
        // This ensures formData is set from invoice FIRST, before customer matching
        console.log('✅ Invoice data loaded into formData - customer matching will happen separately');
      } catch (error) {
        console.error('Error loading invoice data:', error);
        // Clear loading flag on error
        isLoadingInvoiceRef.current = false;
      }
    } else {
      // Reset form for new invoice
      lastLoadedInvoiceIdRef.current = null; // Clear the ref for new invoice
      setFormData({
        invoiceDate: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        clientName: '',
        clientAddress: '',
        clientGstin: '',
        clientState: '',
        placeOfSupply: '',
        gstNo: '',
        clientCountry: 'India',
        clientEmail: '',
        clientMobile: '',
        hsnSac: '',
        currency: 'INR',
        exchangeRate: '',
        notes: '',
        baseAmount: '',
        gstPercentage: '',
        tdsPercentage: '',
        tcsPercentage: '',
        remittanceCharges: '',
        status: 'Unpaid',
      });
      setItems([{
        id: Date.now(),
        name: '',
        hsnSac: '',
        description: '',
        quantity: 1,
        rate: 0,
        discount: 0,
        amount: 0,
      }]);
      setSelectedCustomerId('');
    }
  }, [invoice]); // Only depend on invoice - don't re-run when customers load

  // Separate useEffect for customer matching - only runs when customers or invoice.clientId changes
  useEffect(() => {
    // Only run if we have an invoice and customers are loaded
    if (!invoice || !invoice._id || customers.length === 0) {
      return;
    }

    console.log('🔍 Searching for customer to match with invoice...');
    
    // Try to find and select the customer if it exists
    let foundCustomer = null;
    const invoiceClientDetails = invoice.clientDetails || {};
    const invoiceClientName = invoiceClientDetails.name || invoice.clientName || '';
    const invoiceClientEmail = invoice.clientEmail || invoiceClientDetails.email || '';
    
    console.log('🔍 Customer search criteria:', {
      clientId: invoice.clientId,
      clientName: invoiceClientName,
      clientEmail: invoiceClientEmail,
      customersCount: customers.length
    });
    
    // First check if invoice has a clientId (direct link to customer)
    if (invoice.clientId) {
      foundCustomer = customers.find(c => c._id === invoice.clientId);
      if (foundCustomer) {
        console.log('✅ Found customer by clientId:', foundCustomer.displayName || foundCustomer.clientName);
      }
    } 
    // Otherwise, try to match by email and name
    if (!foundCustomer && invoiceClientEmail) {
      foundCustomer = customers.find(
        c => {
          const emailMatch = c.email && invoiceClientEmail && 
            (c.email === invoiceClientEmail || c.email?.toLowerCase() === invoiceClientEmail?.toLowerCase());
          const nameMatch = invoiceClientName && (
            c.clientName === invoiceClientName || 
            c.displayName === invoiceClientName ||
            c.companyName === invoiceClientName ||
            (c.clientName && invoiceClientName && c.clientName.toLowerCase() === invoiceClientName.toLowerCase()) ||
            (c.displayName && invoiceClientName && c.displayName.toLowerCase() === invoiceClientName.toLowerCase()) ||
            (c.companyName && invoiceClientName && c.companyName.toLowerCase() === invoiceClientName.toLowerCase())
          );
          return emailMatch && nameMatch;
        }
      );
      if (foundCustomer) {
        console.log('✅ Found customer by email + name:', foundCustomer.displayName || foundCustomer.clientName);
      } else {
        // Try matching by email only
        foundCustomer = customers.find(
          c => c.email && invoiceClientEmail && 
            (c.email === invoiceClientEmail || c.email?.toLowerCase() === invoiceClientEmail?.toLowerCase())
        );
        if (foundCustomer) {
          console.log('✅ Found customer by email only:', foundCustomer.displayName || foundCustomer.clientName);
        }
      }
    }
    
    // If still not found, try matching by name only (case-insensitive)
    if (!foundCustomer && invoiceClientName) {
      foundCustomer = customers.find(
        c => {
          const name = c.displayName || c.clientName || c.companyName || '';
          return name && invoiceClientName && 
            (name === invoiceClientName || name.toLowerCase() === invoiceClientName.toLowerCase());
        }
      );
      if (foundCustomer) {
        console.log('✅ Found customer by name only:', foundCustomer.displayName || foundCustomer.clientName);
      }
    }
    
    // ONLY update formData if customer is FOUND
    if (foundCustomer) {
      console.log('✅ Customer found - updating formData with customer master data');
      console.log('✅ Setting selected customer ID:', foundCustomer._id);
      setSelectedCustomerId(foundCustomer._id);
      
      // Auto-fill customer details if customer is found (this will override invoice clientDetails with customer data)
      // This ensures we use the latest customer data
      const gstinValue = foundCustomer.gstin !== undefined && foundCustomer.gstin !== null && foundCustomer.gstin !== '' 
        ? String(foundCustomer.gstin).trim() 
        : (invoice.clientDetails?.gstin || '');
      const hsnSacValue = foundCustomer.hsnOrSac !== undefined && foundCustomer.hsnOrSac !== null && foundCustomer.hsnOrSac !== ''
        ? String(foundCustomer.hsnOrSac).trim()
        : (invoice.items?.[0]?.hsnSac || '');
      
      const clientCountry = foundCustomer.country || foundCustomer.billingAddress?.country || invoice.clientDetails?.country || 'India';
      const isIndianClient = clientCountry === 'India';
      const selectedCurrency = foundCustomer.currency || invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
      const exchangeRate = getExchangeRate(selectedCurrency);
      
      // Update form data with customer details, but preserve invoice-specific data like amounts
      setFormData(prev => ({
        ...prev,
        clientAddress: formatBillingAddress(foundCustomer.billingAddress) || prev.clientAddress,
        clientCity: foundCustomer.billingAddress?.city || prev.clientCity,
        clientPincode: foundCustomer.billingAddress?.pinCode || prev.clientPincode,
        clientGstin: gstinValue,
        clientState: foundCustomer.state || foundCustomer.billingAddress?.state || prev.clientState,
        placeOfSupply: foundCustomer.placeOfSupply || prev.placeOfSupply,
        gstNo: foundCustomer.gstNo || prev.gstNo,
        clientEmail: foundCustomer.email || prev.clientEmail,
        clientMobile: formatMobileNumber(foundCustomer.mobile) || prev.clientMobile,
        hsnSac: hsnSacValue,
        clientName: foundCustomer.displayName || foundCustomer.clientName || foundCustomer.companyName || prev.clientName,
        clientCountry: clientCountry,
        currency: selectedCurrency,
        exchangeRate: selectedCurrency === 'INR' ? '' : String(exchangeRate),
        gstPercentage: isIndianClient && foundCustomer.gstPercentage !== undefined && foundCustomer.gstPercentage !== null && foundCustomer.gstPercentage > 0 ? String(foundCustomer.gstPercentage) : prev.gstPercentage,
        tdsPercentage: isIndianClient && foundCustomer.tdsPercentage !== undefined && foundCustomer.tdsPercentage !== null && foundCustomer.tdsPercentage > 0 ? String(foundCustomer.tdsPercentage) : prev.tdsPercentage,
        tcsPercentage: isIndianClient && foundCustomer.tcsPercentage !== undefined && foundCustomer.tcsPercentage !== null && foundCustomer.tcsPercentage > 0 ? String(foundCustomer.tcsPercentage) : prev.tcsPercentage,
      }));
      console.log('✅ Customer details auto-filled in form');
    } else {
      // Customer NOT found - DO NOT update formData
      // formData already contains invoice data from the first useEffect
      console.log('⚠️ No matching customer found for invoice');
      console.log('✅ Keeping invoice clientDetails data in formData (already set from invoice)');
      setSelectedCustomerId('');
      // DO NOT call setFormData here - invoice data is already in formData!
    }
  }, [customers, invoice?.clientId, invoice?._id]); // Only depend on customers and invoice.clientId

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await itemAPI.getAll();
        setExistingItems(response.data || []);
      } catch (error) {
        console.error('Error fetching items:', error);
        setExistingItems([]);
      }
    };
    fetchItems();
  }, []);

  // HSN/SAC codes are now entered manually; no fetch from backend.

  // Fetch GST/TDS/TCS rates from settings
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await settingsAPI.get();
        const settings = response.data || {};
        setGstRates(settings.gstRates || []);
        setTdsRates(settings.tdsRates || []);
        setTcsRates(settings.tcsRates || []);
      } catch (error) {
        console.error('Error fetching tax rates:', error);
        // Set default rates if API fails
        setGstRates([{ label: '18%', value: 18 }, { label: '12%', value: 12 }, { label: '5%', value: 5 }]);
        setTdsRates([{ label: '10%', value: 10 }, { label: '2%', value: 2 }, { label: '1%', value: 1 }]);
        setTcsRates([{ label: '1%', value: 1 }, { label: '0.1%', value: 0.1 }]);
      }
    };
    fetchRates();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gstDropdownRef.current && !gstDropdownRef.current.contains(event.target)) {
        setOpenGstDropdown(false);
      }
      if (tdsDropdownRef.current && !tdsDropdownRef.current.contains(event.target)) {
        setOpenTdsDropdown(false);
      }
      if (tcsDropdownRef.current && !tcsDropdownRef.current.contains(event.target)) {
        setOpenTcsDropdown(false);
      }
    };

    if (openGstDropdown || openTdsDropdown || openTcsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openGstDropdown, openTdsDropdown, openTcsDropdown]);

  // Clear tax fields when country is not India OR currency is not INR
  useEffect(() => {
    if (formData.clientCountry && formData.clientCountry !== 'India') {
      setFormData(prev => ({
        ...prev,
        gstPercentage: '',
        tdsPercentage: '',
        tcsPercentage: '',
      }));
    }
  }, [formData.clientCountry]);

  // Clear tax fields when currency is not INR (Export of Services)
  useEffect(() => {
    if (formData.currency && formData.currency !== 'INR') {
      setFormData(prev => ({
        ...prev,
        gstPercentage: '',
        tdsPercentage: '',
        tcsPercentage: '',
      }));
      // Close any open dropdowns
      setOpenGstDropdown(false);
      setOpenTdsDropdown(false);
      setOpenTcsDropdown(false);
    }
  }, [formData.currency]);

  // Helper function to format billing address
  const formatBillingAddress = (billingAddress) => {
    if (!billingAddress) return '';
    if (typeof billingAddress === 'string') return billingAddress;
    if (typeof billingAddress === 'object') {
      const addrParts = [];
      if (billingAddress.street1) addrParts.push(billingAddress.street1);
      if (billingAddress.street2) addrParts.push(billingAddress.street2);
      if (billingAddress.city) addrParts.push(billingAddress.city);
      if (billingAddress.state) addrParts.push(billingAddress.state);
      if (billingAddress.pinCode) addrParts.push(billingAddress.pinCode);
      if (billingAddress.country) addrParts.push(billingAddress.country);
      return addrParts.join(', ');
    }
    return '';
  };

  // Helper function to format mobile number
  const formatMobileNumber = (mobile) => {
    if (!mobile) return '';
    if (typeof mobile === 'object' && mobile.number) {
      return mobile.countryCode 
        ? `${mobile.countryCode}${mobile.number}`
        : mobile.number;
    } else if (typeof mobile === 'string') {
      return mobile;
    }
    return '';
  };

  // Helper function to get exchange rate based on currency
  const getExchangeRate = (currency) => {
    const exchangeRates = {
      'USD': 90.13,
      'CAD': 67,
      'AUD': 60,
      'AED': 24.91,  // 1 AED = 24.91 INR
      'INR': 1
    };
    return exchangeRates[currency] || 1;
  };

  const handleCustomerSelect = (e) => {
    const customerId = e.target.value;
    setSelectedCustomerId(customerId);
    
    if (customerId) {
      const selectedCustomer = customers.find(c => c._id === customerId);
      if (selectedCustomer) {
        // Auto-fill client details from customer
        const gstinValue = selectedCustomer.gstin !== undefined && selectedCustomer.gstin !== null && selectedCustomer.gstin !== '' 
          ? String(selectedCustomer.gstin).trim() 
          : '';
        const hsnSacValue = selectedCustomer.hsnOrSac !== undefined && selectedCustomer.hsnOrSac !== null && selectedCustomer.hsnOrSac !== ''
          ? String(selectedCustomer.hsnOrSac).trim()
          : '';
        
        const clientCountry = selectedCustomer.country || selectedCustomer.billingAddress?.country || 'India';
        const isIndianClient = clientCountry === 'India';
        const selectedCurrency = selectedCustomer.currency || 'INR';
        const exchangeRate = getExchangeRate(selectedCurrency);
        
        setFormData({
          ...formData,
          clientAddress: formatBillingAddress(selectedCustomer.billingAddress),
          clientCity: selectedCustomer.billingAddress?.city || '',
          clientPincode: selectedCustomer.billingAddress?.pinCode || '',
          clientGstin: gstinValue,
          clientState: selectedCustomer.state || selectedCustomer.billingAddress?.state || '',
          placeOfSupply: selectedCustomer.placeOfSupply || '',
          gstNo: selectedCustomer.gstNo || '',
          clientEmail: selectedCustomer.email || '',
          clientMobile: formatMobileNumber(selectedCustomer.mobile),
          hsnSac: hsnSacValue,
          clientName: selectedCustomer.clientName || selectedCustomer.displayName || '',
          clientCountry: clientCountry,
          currency: selectedCurrency,
          exchangeRate: selectedCurrency === 'INR' ? '' : String(exchangeRate),
          gstPercentage: isIndianClient && selectedCustomer.gstPercentage !== undefined && selectedCustomer.gstPercentage !== null && selectedCustomer.gstPercentage > 0 ? String(selectedCustomer.gstPercentage) : '',
          tdsPercentage: isIndianClient && selectedCustomer.tdsPercentage !== undefined && selectedCustomer.tdsPercentage !== null && selectedCustomer.tdsPercentage > 0 ? String(selectedCustomer.tdsPercentage) : '',
          tcsPercentage: isIndianClient && selectedCustomer.tcsPercentage !== undefined && selectedCustomer.tcsPercentage !== null && selectedCustomer.tcsPercentage > 0 ? String(selectedCustomer.tcsPercentage) : '',
        });
        // Auto-expand Client Details section when customer is selected
        setShowClientDetails(true);
      }
    } else {
      // Clear customer fields if no customer selected
      setFormData({
        ...formData,
        clientAddress: '',
        clientCity: '',
        clientPincode: '',
        clientGstin: '',
        clientState: '',
        placeOfSupply: '',
        gstNo: '',
        clientEmail: '',
        clientMobile: '',
        hsnSac: '',
        clientName: '',
        clientCountry: 'India',
        currency: 'INR',
        exchangeRate: '',
        gstPercentage: '',
        tdsPercentage: '',
        tcsPercentage: '',
      });
    }
  };

  const handleNewCustomerChange = (e) => {
    const { name, value } = e.target;
    setNewCustomerData({
      ...newCustomerData,
      [name]: value,
    });
  };

  const handleAddCustomer = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation();
    }
    
    // Validate required fields
    if (!newCustomerData.clientName || !newCustomerData.email || !newCustomerData.country || !newCustomerData.currency) {
      showToast('Please fill all required fields (Client Name, Email, Country, Currency)', 'error');
      return false;
    }
    
    try {
      // Create customer in backend
      const response = await customerAPI.create(newCustomerData);
      const newCustomer = response.data;
      
      // Refresh customers list silently (without navigation)
      // This updates the parent's customers list, which will be passed back as props
      // This ensures the customer appears in the Customers tab
      if (onCustomerAdded) {
        await onCustomerAdded();
      }
      
      // Auto-select the new customer
      setSelectedCustomerId(newCustomer._id);
      
      // Auto-fill invoice form with customer data (preserve existing form data)
      const gstinValue = newCustomer.gstin !== undefined && newCustomer.gstin !== null && newCustomer.gstin !== '' 
        ? String(newCustomer.gstin).trim() 
        : '';
      const hsnSacValue = newCustomer.hsnOrSac !== undefined && newCustomer.hsnOrSac !== null && newCustomer.hsnOrSac !== ''
        ? String(newCustomer.hsnOrSac).trim()
        : '';
      
      const clientCountry = newCustomer.country || newCustomer.billingAddress?.country || 'India';
      const isIndianClient = clientCountry === 'India';
      
      const newCustomerCurrency = newCustomer.currency || 'INR';
      const newCustomerExchangeRate = getExchangeRate(newCustomerCurrency);
      
      setFormData(prevFormData => ({
        ...prevFormData,
        clientAddress: formatBillingAddress(newCustomer.billingAddress),
        clientCity: newCustomer.billingAddress?.city || '',
        clientPincode: newCustomer.billingAddress?.pinCode || '',
        clientGstin: gstinValue,
        clientState: newCustomer.state || newCustomer.billingAddress?.state || '',
        placeOfSupply: newCustomer.placeOfSupply || '',
        gstNo: newCustomer.gstNo || '',
        clientEmail: newCustomer.email || '',
        clientMobile: formatMobileNumber(newCustomer.mobile),
        hsnSac: hsnSacValue,
        clientName: newCustomer.clientName || newCustomer.displayName || '',
        clientCountry: clientCountry,
        currency: newCustomerCurrency,
        exchangeRate: newCustomerCurrency === 'INR' ? '' : String(newCustomerExchangeRate),
        gstPercentage: isIndianClient && newCustomer.gstPercentage !== undefined && newCustomer.gstPercentage !== null && newCustomer.gstPercentage > 0 ? String(newCustomer.gstPercentage) : '',
        tdsPercentage: isIndianClient && newCustomer.tdsPercentage !== undefined && newCustomer.tdsPercentage !== null && newCustomer.tdsPercentage > 0 ? String(newCustomer.tdsPercentage) : '',
        tcsPercentage: isIndianClient && newCustomer.tcsPercentage !== undefined && newCustomer.tcsPercentage !== null && newCustomer.tcsPercentage > 0 ? String(newCustomer.tcsPercentage) : '',
      }));
      
      // Hide add customer form
      setShowAddCustomer(false);
      
      // Reset new customer form
      setNewCustomerData({
        clientName: '',
        billingAddress: '',
        gstin: '',
        state: '',
        country: 'India',
        email: '',
        mobile: '',
        hsnOrSac: '',
        currency: 'INR',
      });
      
      // Show success message (non-blocking)
      console.log('Customer added successfully and form auto-filled!');
      
      // Return false to prevent any form submission
      return false;
    } catch (error) {
      console.error('Error creating customer:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create customer';
      showToast(errorMessage, 'error');
      return false;
    }
  };


  // Calculate item amount based on quantity, rate, and discount
  const calculateItemAmount = (quantity, rate, discount) => {
    const qty = parseFloat(quantity) || 0;
    const rt = parseFloat(rate) || 0;
    const disc = parseFloat(discount) || 0;
    const subtotal = qty * rt;
    const discountAmount = (subtotal * disc) / 100;
    return subtotal - discountAmount;
  };

  // Auto-create item if it doesn't exist
  const autoCreateItemIfNew = async (itemDescription, hsnSac) => {
    if (!itemDescription || itemDescription.trim() === '') return;

    // Check if item already exists
    const itemExists = existingItems.some(
      item => item.name.toLowerCase().trim() === itemDescription.toLowerCase().trim()
    );

    if (!itemExists) {
      try {
        // Create new item in backend
        const newItemData = {
          type: 'Service', // Default to Service, can be changed later
          name: itemDescription.trim(),
          unit: '',
          sellable: true,
          sellingPrice: 0,
          salesAccount: 'Sales',
          salesDescription: '',
          purchasable: false,
          costPrice: 0,
          purchaseAccount: 'Cost of Goods Sold',
          purchaseDescription: '',
        };

        await itemAPI.create(newItemData);
        
        // Refresh items list
        const response = await itemAPI.getAll();
        setExistingItems(response.data || []);
        
        console.log('New item created automatically:', itemDescription);
      } catch (error) {
        console.error('Error auto-creating item:', error);
        // Don't show alert for auto-create failures to avoid interrupting user flow
      }
    }
  };

  // Handle HSN/SAC selection with auto-GST
  const handleHsnSacSelect = (itemId, codeValue) => {
    // Find the selected HSN/SAC code
    const selectedCode = hsnSacCodes.find(
      code => code.code === codeValue || 
              `${code.code} - ${code.description}` === codeValue
    );

    if (selectedCode) {
      // Update item with code and auto-apply GST
      setItems(prevItems => {
        return prevItems.map(item => {
          if (item.id === itemId) {
            const updatedItem = {
              ...item,
              hsnSac: selectedCode.code,
            };
            
            // Auto-apply GST rate to form ONLY if not already set by user
            // Check for both empty string and 0 to ensure user's selection is preserved
            if (!formData.gstPercentage || formData.gstPercentage === '' || formData.gstPercentage === 0) {
              setFormData(prev => ({
                ...prev,
                gstPercentage: selectedCode.gstRate,
              }));
            }
            
            return updatedItem;
          }
          return item;
        });
      });
    } else {
      // Just update the code if no match found
      handleItemChange(itemId, 'hsnSac', codeValue);
    }
  };

  // Update item and recalculate amount
  const handleItemChange = async (itemId, field, value) => {
    setItems(prevItems => {
      return prevItems.map(item => {
        if (item.id === itemId) {
          const updatedItem = {
            ...item,
            [field]: field === 'quantity' || field === 'rate' || field === 'discount' 
              ? (value === '' ? '' : parseFloat(value) || 0)
              : value,
          };
          
          // Recalculate amount if quantity, rate, or discount changed
          if (field === 'quantity' || field === 'rate' || field === 'discount') {
            updatedItem.amount = calculateItemAmount(
              updatedItem.quantity,
              updatedItem.rate,
              updatedItem.discount
            );
          }

          // Auto-create item if description is new (debounced)
          if (field === 'description' && value && value.trim() !== '') {
            // Clear existing timeout for this item
            if (autoCreateTimeoutRef.current[itemId]) {
              clearTimeout(autoCreateTimeoutRef.current[itemId]);
            }
            // Set new timeout to debounce the auto-create
            autoCreateTimeoutRef.current[itemId] = setTimeout(() => {
              autoCreateItemIfNew(value, updatedItem.hsnSac);
              delete autoCreateTimeoutRef.current[itemId];
            }, 2000); // Wait 2 seconds after user stops typing
          }
          
          return updatedItem;
        }
        return item;
      });
    });
  };

  // Add new item row
  const handleAddItem = () => {
    setItems(prevItems => [
      ...prevItems,
      {
        id: Date.now(),
        name: '',
        hsnSac: '',
        description: '',
        quantity: 1,
        rate: 0,
        discount: 0,
        amount: 0,
      },
    ]);
  };

  // Delete all items
  const handleDeleteAllItems = () => {
    if (items.length === 0) return;
    setDeleteAllItemsConfirm(true);
  };

  const handleDeleteAllItemsConfirm = () => {
    // Clear all auto-create timeouts
    Object.keys(autoCreateTimeoutRef.current).forEach(itemId => {
      clearTimeout(autoCreateTimeoutRef.current[itemId]);
    });
    autoCreateTimeoutRef.current = {};
    
    // Reset to a single empty item
    setItems([{
      id: Date.now(),
      name: '',
      hsnSac: '',
      description: '',
      quantity: 1,
      rate: 0,
      discount: 0,
      amount: 0,
    }]);
    
    // Reset base amount
    setFormData({ ...formData, baseAmount: '' });
    setDeleteAllItemsConfirm(false);
  };

  const handleDeleteItemConfirm = () => {
    if (deleteItemConfirm.itemId) {
      handleRemoveItem(deleteItemConfirm.itemId);
      setDeleteItemConfirm({ show: false, itemId: null });
    }
  };

  // Delete item from the items array
  const handleRemoveItem = (itemId) => {
    // Clear any pending auto-create timeout for this item
    if (autoCreateTimeoutRef.current[itemId]) {
      clearTimeout(autoCreateTimeoutRef.current[itemId]);
      delete autoCreateTimeoutRef.current[itemId];
    }
    
    // Clear HSN/SAC search term for this item
    setHsnSacSearchTerm(prev => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
    
    // Actually delete the item from the array
    setItems(prevItems => {
      const filtered = prevItems.filter(item => item.id !== itemId);
      
      // If no items remain, add one empty item to ensure at least one row exists
      if (filtered.length === 0) {
        return [{
          id: Date.now(),
          name: '',
          hsnSac: '',
          description: '',
          quantity: 1,
          rate: 0,
          discount: 0,
          amount: 0,
        }];
      }
      
      return filtered;
    });
  };

  // Update baseAmount when items change
  useEffect(() => {
    const totalAmount = items.reduce((total, item) => {
      return total + (item.amount || 0);
    }, 0);
    setFormData(prev => ({
      ...prev,
      baseAmount: totalAmount > 0 ? String(totalAmount.toFixed(2)) : '',
    }));
  }, [items]);

  // Calculate invoice amounts for display
  const calculateInvoiceAmounts = () => {
    const baseAmount = parseFloat(formData.baseAmount) || 0;
    const gstPercentage = parseFloat(formData.gstPercentage) || 0;
    const tdsPercentage = parseFloat(formData.tdsPercentage) || 0;
    const tcsPercentage = parseFloat(formData.tcsPercentage) || 0;
    const remittanceCharges = parseFloat(formData.remittanceCharges) || 0;

    // Determine client location rules:
    // - Currency ≠ INR OR Country ≠ India: GST = 0%, TDS = 0, TCS = 0 (Export of Services)
    // - Currency = INR AND Country = India, Gujarat: CGST + SGST (9% + 9% = 18%), TDS = 10%, TCS = Rare
    // - Currency = INR AND Country = India, Other State: IGST (18%), TDS = 10%, TCS = Rare
    const isForeignClient = (formData.currency && formData.currency !== 'INR') || (formData.clientCountry && formData.clientCountry !== 'India');
    
    // Calculate GST based on location
    let totalGst = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    
    if (!isForeignClient && gstPercentage > 0) {
      // Calculate GST only for INR currency and Indian clients
      totalGst = (baseAmount * gstPercentage) / 100;
      
      // Determine GST type based on place of supply
      const placeOfSupply = formData.placeOfSupply || formData.clientState || '';
      const isGujarat = placeOfSupply === 'Gujarat';
      
      if (isGujarat) {
        // Gujarat: CGST + SGST (9% + 9% = 18%)
        cgst = totalGst / 2;
        sgst = totalGst / 2;
        igst = 0;
      } else {
        // Other Indian states: IGST (18%)
        igst = totalGst;
        cgst = 0;
        sgst = 0;
      }
    } else {
      // Outside India: No GST
      totalGst = 0;
      cgst = 0;
      sgst = 0;
      igst = 0;
    }

    // Calculate TDS and TCS
    // Foreign clients (Currency ≠ INR OR Country ≠ India): TDS = 0, TCS = 0
    // Indian clients with INR: TDS = 10% (or user input), TCS = Rare (or user input)
    const tdsAmount = isForeignClient ? 0 : (baseAmount * tdsPercentage) / 100;
    const tcsAmount = isForeignClient ? 0 : (baseAmount * tcsPercentage) / 100;

    // Sub Total = Base Amount (Items Total)
    const subTotal = baseAmount;

    // Invoice Total = Base Amount + GST (for PDF)
    const invoiceTotal = baseAmount + totalGst;

    // Receivable Amount = Base Amount + GST - TDS - Remittance (for Revenue)
    // Formula: sum(G8+J8-K8-L8) where G8=Base, J8=GST, K8=TDS, L8=Remittance
    // Note: TCS is NOT deducted from receivable amount
    const receivableAmount = baseAmount + totalGst - tdsAmount - remittanceCharges;

    return {
      baseAmount,
      subTotal: Math.round(subTotal * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      totalGst: Math.round(totalGst * 100) / 100,
      tdsAmount: Math.round(tdsAmount * 100) / 100,
      tcsAmount: Math.round(tcsAmount * 100) / 100,
      remittanceCharges: Math.round(remittanceCharges * 100) / 100,
      invoiceTotal: Math.round(invoiceTotal * 100) / 100,
      receivableAmount: Math.round(receivableAmount * 100) / 100,
      isGujarat: formData.placeOfSupply === 'Gujarat' || formData.clientState === 'Gujarat',
    };
  };

  const calculatedAmounts = calculateInvoiceAmounts();

  // Handler to add new GST/TDS/TCS rate
  const handleAddRate = async (type) => {
    if (!newRateValue || newRateValue === '') {
      showToast('Please enter a percentage value', 'error');
      return;
    }

    const percentageValue = parseFloat(newRateValue);
    if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
      showToast('Please enter a valid percentage between 0 and 100', 'error');
      return;
    }

    try {
      const response = await settingsAPI.get();
      const settings = response.data;
      
      // Automatically generate label from percentage value (e.g., 18 -> "18%")
      const rateToAdd = {
        label: `${percentageValue}%`,
        value: percentageValue,
      };

      let updatedRates = [];
      if (type === 'gst') {
        updatedRates = [...(settings.gstRates || []), rateToAdd];
        setGstRates(updatedRates);
      } else if (type === 'tds') {
        updatedRates = [...(settings.tdsRates || []), rateToAdd];
        setTdsRates(updatedRates);
      } else if (type === 'tcs') {
        updatedRates = [...(settings.tcsRates || []), rateToAdd];
        setTcsRates(updatedRates);
      }

      await settingsAPI.update({
        ...settings,
        gstRates: type === 'gst' ? updatedRates : settings.gstRates,
        tdsRates: type === 'tds' ? updatedRates : settings.tdsRates,
        tcsRates: type === 'tcs' ? updatedRates : settings.tcsRates,
      });

      // Set the newly added rate in the form (round to 2 decimal places to avoid precision issues)
      if (type === 'gst') {
        setFormData({ ...formData, gstPercentage: Math.round(rateToAdd.value * 100) / 100 });
        setShowAddGstModal(false);
      } else if (type === 'tds') {
        setFormData({ ...formData, tdsPercentage: Math.round(rateToAdd.value * 100) / 100 });
        setShowAddTdsModal(false);
      } else if (type === 'tcs') {
        setFormData({ ...formData, tcsPercentage: Math.round(rateToAdd.value * 100) / 100 });
        setShowAddTcsModal(false);
      }

      setNewRateValue('');
    } catch (error) {
      console.error('Error adding rate:', error);
      showToast('Failed to add rate. Please try again.', 'error');
    }
  };

  // Prevent arrow keys and scroll from changing number input values
  const handleNumberInputKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
  };

  const handleNumberInputWheel = (e) => {
    if (e.target.type === 'number') {
      e.target.blur();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Prevent editing email if customer is selected
    if (name === 'clientEmail' && selectedCustomerId) {
      return; // Email is read-only when customer is selected
    }
    
    // Automatically set exchange rate when currency changes
    if (name === 'currency') {
      const exchangeRate = getExchangeRate(value);
      setFormData({
        ...formData,
        currency: value,
        exchangeRate: value === 'INR' ? '' : String(exchangeRate),
      });
      return;
    }
    
    setFormData({
      ...formData,
      [name]: ['exchangeRate', 'gstPercentage', 'tdsPercentage', 'tcsPercentage'].includes(name)
        ? (value === '' ? '' : (() => {
            const numValue = parseFloat(value);
            // For percentage fields, round to 2 decimal places to avoid precision issues
            return isNaN(numValue) ? '' : (name === 'gstPercentage' || name === 'tdsPercentage' || name === 'tcsPercentage' 
              ? Math.round(numValue * 100) / 100 
              : numValue);
          })())
        : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't submit if customer form is open
    if (showAddCustomer) {
      return;
    }
    
    if (!invoice) {
      if (!selectedCustomerId) {
        showToast('Please select a customer to create invoice', 'error');
        return;
      }
      if (!formData.clientEmail || formData.clientEmail.trim() === '') {
        showToast('Client email is required. Please select a customer with email.', 'error');
        return;
      }
      if (!formData.baseAmount || parseFloat(formData.baseAmount) <= 0) {
        showToast('Base amount is required and must be greater than 0', 'error');
        return;
      }
    }

    // Validate items - check for name (main identifier)
    const validItems = items.filter(item => item.name && item.name.trim() !== '');
    if (validItems.length === 0) {
      showToast('Please add at least one item with name', 'error');
      return;
    }

    // SAFETY VALIDATION - Prevent duplicate and invalid items
    console.log('🔍 Validating items before submission...');
    
    // Prepare items for submission (remove discount as it's calculated into amount)
    let submitItems = items
      .filter(item => item.name && item.name.trim() !== '')
      .map((item, index) => ({
        name: item.name.trim(), // Item name (main identifier)
        description: item.description.trim() || '', // Manual description
        hsnSac: item.hsnSac || formData.hsnSac || '',
        quantity: parseFloat(item.quantity) || 1,
        rate: parseFloat(item.rate) || 0,
        amount: parseFloat(item.amount) || 0,
      }));

    // Remove duplicate items based on name (case-insensitive)
    const uniqueItems = [];
    const seenNames = new Set();
    
    submitItems.forEach((item, index) => {
      const normalizedName = item.name.toLowerCase().trim();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        uniqueItems.push(item);
        console.log(`✅ Item ${index + 1}: "${item.name}" - Valid`);
      } else {
        console.log(`⚠️ Item ${index + 1}: "${item.name}" - Duplicate removed`);
      }
    });
    
    submitItems = uniqueItems;
    
    // Validate that we have at least one valid item
    if (submitItems.length === 0) {
      showToast('Please add at least one item with a description', 'error');
      return;
    }
    
    console.log(`📋 Final items for submission: ${submitItems.length} unique items`);
    submitItems.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.description} - Qty: ${item.quantity}, Rate: ${item.rate}, Amount: ${item.amount}`);
    });

    // Validate that all items have valid amounts
    const invalidItems = submitItems.filter(item => item.amount <= 0);
    if (invalidItems.length > 0) {
      showToast('All items must have a valid amount greater than 0', 'error');
      return;
    }

    // Calculate base amount from items
    const calculatedBaseAmount = submitItems.reduce((total, item) => total + (item.amount || 0), 0);

    // Check if amounts are being changed for a Paid invoice
    let finalStatus = formData.status || 'Unpaid';
    if (invoice && invoice.status === 'Paid') {
      const originalBaseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || 0;
      const originalGstPercent = invoice.gstPercentage || 0;
      const originalTdsPercent = invoice.tdsPercentage || 0;
      const originalTcsPercent = invoice.tcsPercentage || 0;
      const originalRemittance = invoice.remittanceCharges || 0;
      
      const newBaseAmount = calculatedBaseAmount || originalBaseAmount;
      const newGstPercent = formData.gstPercentage ? parseFloat(formData.gstPercentage) : originalGstPercent;
      const newTdsPercent = formData.tdsPercentage ? parseFloat(formData.tdsPercentage) : originalTdsPercent;
      const newTcsPercent = formData.tcsPercentage ? parseFloat(formData.tcsPercentage) : originalTcsPercent;
      const newRemittance = formData.remittanceCharges ? parseFloat(formData.remittanceCharges) : originalRemittance;
      
      // Check if any amount-related fields have changed
      const amountsChanged = 
        Math.abs(newBaseAmount - originalBaseAmount) > 0.01 ||
        Math.abs(newGstPercent - originalGstPercent) > 0.01 ||
        Math.abs(newTdsPercent - originalTdsPercent) > 0.01 ||
        Math.abs(newTcsPercent - originalTcsPercent) > 0.01 ||
        Math.abs(newRemittance - originalRemittance) > 0.01 ||
        // Check if items have changed
        (submitItems.length !== invoice.items?.length) ||
        submitItems.some((item, index) => {
          const originalItem = invoice.items?.[index];
          return !originalItem || 
                 Math.abs(item.amount - (originalItem.amount || 0)) > 0.01 ||
                 item.description !== originalItem.description;
        });
      
      if (amountsChanged) {
        console.log('💰 Paid invoice amounts changed - automatically setting status to Unpaid');
        finalStatus = 'Unpaid';
        // Don't send status explicitly - let backend handle it, but we'll set it to Unpaid
      }
    }

    const submitData = {
      ...formData,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      exchangeRate: formData.exchangeRate ? parseFloat(formData.exchangeRate) : 1,
      baseAmount: calculatedBaseAmount || (invoice ? (invoice.amountDetails?.baseAmount || invoice.subTotal || 0) : 0),
      gstPercentage: formData.gstPercentage ? parseFloat(formData.gstPercentage) : 0,
      tdsPercentage: formData.tdsPercentage ? parseFloat(formData.tdsPercentage) : 0,
      tcsPercentage: formData.tcsPercentage ? parseFloat(formData.tcsPercentage) : 0,
      remittanceCharges: formData.remittanceCharges ? parseFloat(formData.remittanceCharges) : 0,
      clientName: formData.clientName || invoice?.clientDetails?.name || '',
      clientCountry: formData.clientCountry || invoice?.clientDetails?.country || 'India',
      clientCity: formData.clientCity || '',
      clientPincode: formData.clientPincode || '',
      currency: formData.currency || 'INR',
      // For Paid invoices with changed amounts, don't send status (backend will auto-set to Unpaid)
      // For other cases, send the status
      status: (invoice && invoice.status === 'Paid' && finalStatus === 'Unpaid') ? undefined : finalStatus,
      items: submitItems, // Include items array
    };

    onSubmit(submitData);
  };

  // Debug: Log formData whenever it changes to see if it's being set correctly
  useEffect(() => {
    if (invoice && invoice._id) {
      console.log('🔍 Current formData state:', {
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientMobile: formData.clientMobile,
        clientAddress: formData.clientAddress,
        clientGstin: formData.clientGstin,
        clientState: formData.clientState,
      });
    }
  }, [formData, invoice]);

  useEffect(() => {
    if (invoice && invoice._id) {
      // Auto-expand Client Details section when editing invoice with client data
      const hasClientData = invoice.clientDetails?.address || invoice.clientDetails?.gstin || invoice.clientDetails?.state || 
          invoice.clientEmail || invoice.clientMobile || invoice.clientDetails?.placeOfSupply ||
          invoice.clientDetails?.name || invoice.clientDetails?.gstNo ||
          invoice.clientAddress || invoice.clientGstin || invoice.clientState;
      
      if (hasClientData) {
        console.log('📝 Auto-expanding Client Details section - invoice has client data');
        console.log('📋 Client data check:', {
          address: invoice.clientDetails?.address,
          gstin: invoice.clientDetails?.gstin,
          state: invoice.clientDetails?.state,
          email: invoice.clientEmail,
          mobile: invoice.clientMobile,
          placeOfSupply: invoice.clientDetails?.placeOfSupply,
          name: invoice.clientDetails?.name,
          gstNo: invoice.clientDetails?.gstNo,
        });
        setShowClientDetails(true);
      } else {
        console.log('⚠️ No client data found in invoice - Client Details section will remain collapsed');
      }
      if (invoice.notes) setShowAdditionalInfo(true);
    }
  }, [invoice]);

  // Auto-select customer when redirected from customer creation
  useEffect(() => {
    if (pendingCustomerSelect && customers.length > 0 && !selectedCustomerId) {
      const customer = customers.find(c => c._id === pendingCustomerSelect);
      if (customer) {
        setSelectedCustomerId(pendingCustomerSelect);
        // Auto-fill client details from customer
        const gstinValue = customer.gstin !== undefined && customer.gstin !== null && customer.gstin !== '' 
          ? String(customer.gstin).trim() 
          : '';
        const hsnSacValue = customer.hsnOrSac !== undefined && customer.hsnOrSac !== null && customer.hsnOrSac !== ''
          ? String(customer.hsnOrSac).trim()
          : '';
        
        setFormData(prev => ({
          ...prev,
          clientAddress: formatBillingAddress(customer.billingAddress),
          clientGstin: gstinValue,
          clientState: customer.state || customer.billingAddress?.state || '',
          placeOfSupply: customer.placeOfSupply || '',
          gstNo: customer.gstNo || '',
          clientEmail: customer.email || '',
          clientMobile: formatMobileNumber(customer.mobile),
          hsnSac: hsnSacValue,
          clientName: customer.clientName || customer.displayName || '',
          clientCountry: customer.country || customer.billingAddress?.country || 'India',
          currency: customer.currency || 'INR',
          gstPercentage: customer.gstPercentage !== undefined && customer.gstPercentage !== null && customer.gstPercentage > 0 ? String(customer.gstPercentage) : '',
          tdsPercentage: customer.tdsPercentage !== undefined && customer.tdsPercentage !== null && customer.tdsPercentage > 0 ? String(customer.tdsPercentage) : '',
          tcsPercentage: customer.tcsPercentage !== undefined && customer.tcsPercentage !== null && customer.tcsPercentage > 0 ? String(customer.tcsPercentage) : '',
        }));
        if (onCustomerSelected) {
          onCustomerSelected();
        }
      }
    }
  }, [pendingCustomerSelect, customers, selectedCustomerId]);

  return (
    <div className={invoice ? '' : 'bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4'}>
      {!invoice && (
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
          <h2 className="text-lg font-bold text-finance-navy">
            Create Invoice
          </h2>
        </div>
      )}
      <form onSubmit={handleSubmit} className={invoice ? 'space-y-6' : 'space-y-3'}>
        {/* Customer Name Section - Show for both create and edit */}
        <div>
          <label className="form-label">Customer Name *</label>
          <div className="flex gap-3">
            <MobileSelect
              value={selectedCustomerId}
              onChange={handleCustomerSelect}
              required
              className="select-field-compact flex-1"
            >
              <option value="">Select or add a customer</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.displayName || customer.clientName || customer.companyName} - {customer.email} - {customer.country || 'India'} ({customer.currency || 'INR'})
                </option>
              ))}
            </MobileSelect>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Navigate to customers page with return state
                // Always use /invoices as return path (standard route)
                navigate('/customers', {
                  state: {
                    returnTo: '/invoices',
                    returnState: {
                      showInvoiceForm: true,
                      invoiceId: invoice?._id,
                    },
                  },
                });
              }}
              className="px-4 py-2 bg-finance-blue text-white rounded-md hover:bg-finance-blueLight transition-colors text-sm font-medium"
            >
              + Add
            </button>
          </div>
        </div>

        {!invoice && (
          <>

            {/* Add New Customer Form */}
            {showAddCustomer && (
              <div 
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 mb-2"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h3 className="text-sm font-semibold text-finance-navy mb-3">Add New Customer</h3>
                <div 
                  className="space-y-3"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="form-label">Client Name *</label>
                      <input
                        type="text"
                        name="clientName"
                        value={newCustomerData.clientName}
                        onChange={handleNewCustomerChange}
                        required
                        className="input-field-compact"
                        placeholder="Enter client name"
                      />
                    </div>
                    <div>
                      <label className="form-label">Client Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={newCustomerData.email}
                        onChange={handleNewCustomerChange}
                        required
                        className="input-field-compact"
                        placeholder="Enter email"
                      />
                    </div>
                    <div>
                      <label className="form-label">Client Mobile</label>
                      <input
                        type="tel"
                        name="mobile"
                        value={newCustomerData.mobile}
                        onChange={handleNewCustomerChange}
                        className="input-field-compact"
                        placeholder="Enter mobile"
                      />
                    </div>
                    <div>
                      <label className="form-label">Country *</label>
                      <MobileSelect
                        name="country"
                        value={newCustomerData.country}
                        onChange={handleNewCustomerChange}
                        required
                        className="select-field-compact"
                      >
                        <option value="India">India</option>
                        <option value="USA">USA</option>
                        <option value="Canada">Canada</option>
                        <option value="Australia">Australia</option>
                      </MobileSelect>
                    </div>
                    <div>
                      <label className="form-label">Currency *</label>
                      <MobileSelect
                        name="currency"
                        value={newCustomerData.currency}
                        onChange={handleNewCustomerChange}
                        required
                        className="select-field-compact"
                      >
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                        <option value="CAD">CAD</option>
                        <option value="AUD">AUD</option>
                      </MobileSelect>
                    </div>
                    <div>
                      <label className="form-label">Client State</label>
                      <input
                        type="text"
                        name="state"
                        value={newCustomerData.state}
                        onChange={handleNewCustomerChange}
                        className="input-field-compact"
                        placeholder="Enter state"
                      />
                    </div>
                    <div>
                      <label className="form-label">Client GSTIN</label>
                      <input
                        type="text"
                        name="gstin"
                        value={newCustomerData.gstin}
                        onChange={handleNewCustomerChange}
                        className="input-field-compact"
                        placeholder="Enter GSTIN"
                      />
                    </div>
                    <div>
                      <label className="form-label">HSN/SAC Code</label>
                      <input
                        type="text"
                        name="hsnOrSac"
                        value={newCustomerData.hsnOrSac}
                        onChange={handleNewCustomerChange}
                        className="input-field-compact"
                        placeholder="Enter HSN/SAC"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="form-label">Billing Address</label>
                      <textarea
                        name="billingAddress"
                        value={newCustomerData.billingAddress}
                        onChange={handleNewCustomerChange}
                        rows="2"
                        className="input-field-compact resize-none"
                        placeholder="Enter billing address"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCustomer(false);
                        setNewCustomerData({
                          clientName: '',
                          billingAddress: '',
                          gstin: '',
                          state: '',
                          country: 'India',
                          email: '',
                          mobile: '',
                          hsnOrSac: '',
                          currency: 'INR',
                        });
                      }}
                      className="btn-secondary px-4 py-2 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddCustomer(e);
                      }}
                      className="btn-primary px-4 py-2 text-sm"
                    >
                      Add Customer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Dates Section */}
        <div className={invoice ? 'bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6' : ''}>
          <div className={invoice ? 'mb-4 pb-3 border-b border-slate-200' : ''}>
            <h3 className={invoice ? 'text-base font-bold text-slate-900 flex items-center gap-2' : 'hidden'}>
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Dates
            </h3>
          </div>

        {/* Critical Fields - Always Visible */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">Invoice Date *</label>
            <input
              type="date"
              name="invoiceDate"
              value={formData.invoiceDate}
              onChange={handleChange}
              required
              className="input-field-compact"
            />
          </div>
          <div>
            <label className="form-label">Due Date *</label>
            <input
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleChange}
              required
              className="input-field-compact"
            />
          </div>
          <div>
            <label className="form-label">Status *</label>
            <MobileSelect
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              disabled={false}
              className="select-field-compact"
            >
              <option value="Unpaid">Unpaid</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </MobileSelect>
            {invoice && formData.status === 'Paid' && (
              <p className="text-xs text-gray-500 mt-1">Status will change to "Unpaid" if amounts are edited</p>
            )}
          </div>
        </div>
        </div>

        {/* Item Table */}
        <div className={invoice ? 'bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6' : 'border-t border-slate-200 pt-3'}>
          <div className={`flex items-center justify-between ${invoice ? 'mb-4 pb-3 border-b border-slate-200' : 'mb-3'}`}>
            <h3 className={`${invoice ? 'text-base font-bold text-slate-900 flex items-center gap-2' : 'text-sm font-bold text-gray-800'}`}>
              {invoice && (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )}
              Item Table
            </h3>
            <div className="flex gap-2">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllItems}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-600 rounded hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1"
                  title="Delete all items"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete All
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  // Navigate to items page with return path
                  // Store current path or default to /invoices
                  // Always use /invoices as return path (standard route)
                  const returnPath = '/invoices';
                  navigate('/items', { 
                    state: { 
                      returnTo: returnPath,
                      returnState: { 
                        showInvoiceForm: true, 
                        invoiceId: invoice?._id,
                        activeTab: 'invoices'
                      } 
                    } 
                  });
                }}
                className="px-3 py-1.5 text-xs font-medium text-green-600 border border-green-600 rounded hover:bg-green-600 hover:text-white transition-colors"
              >
                + Add New Item
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200 w-48">ITEM NAME</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-r border-gray-200 w-24">QUANTITY</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-r border-gray-200 w-28">
                    RATE
                    <span className="ml-1 text-gray-500">🔢</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-r border-gray-200 w-28">DISCOUNT</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-r border-gray-200 w-28">AMOUNT</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 w-12"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr 
                    key={item.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <div className="relative">
                          <input
                            type="text"
                            list={`item-list-${item.id}`}
                            value={item.name}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleItemChange(item.id, 'name', value);
                              
                              // Auto-fill rate and hsnSac when item is selected from dropdown or typed exactly
                              const matchedItem = existingItems.find(
                                existingItem => existingItem.name.toLowerCase().trim() === value.toLowerCase().trim()
                              );
                              if (matchedItem) {
                                if (matchedItem.sellingPrice && matchedItem.sellingPrice > 0) {
                                  handleItemChange(item.id, 'rate', matchedItem.sellingPrice);
                                }
                                if (matchedItem.hsnSac && matchedItem.hsnSac.trim()) {
                                  handleItemChange(item.id, 'hsnSac', matchedItem.hsnSac.trim());
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              // Auto-fill when user leaves the field if exact match found
                              const matchedItem = existingItems.find(
                                existingItem => existingItem.name.toLowerCase().trim() === value.toLowerCase().trim()
                              );
                              if (matchedItem) {
                                // Update all fields if available
                                handleItemChange(item.id, 'name', matchedItem.name);
                                if (matchedItem.sellingPrice && matchedItem.sellingPrice > 0) {
                                  handleItemChange(item.id, 'rate', matchedItem.sellingPrice);
                                }
                                if (matchedItem.hsnSac && matchedItem.hsnSac.trim()) {
                                  handleItemChange(item.id, 'hsnSac', matchedItem.hsnSac.trim());
                                }
                              }
                            }}
                            placeholder="Type or select item name"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-finance-blue"
                          />
                          <datalist id={`item-list-${item.id}`}>
                            {existingItems.map((existingItem) => (
                              <option key={existingItem._id} value={existingItem.name}>
                                {existingItem.sellingPrice ? `₹${existingItem.sellingPrice}` : ''}
                              </option>
                            ))}
                          </datalist>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            list={`hsn-sac-list-${item.id}`}
                            value={item.hsnSac}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleItemChange(item.id, 'hsnSac', value);
                              setHsnSacSearchTerm(prev => ({ ...prev, [item.id]: value }));
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              // Try to match by code or full string
                              const matchedCode = hsnSacCodes.find(
                                code => code.code === value || 
                                        `${code.code} - ${code.description}` === value ||
                                        code.code.startsWith(value)
                              );
                              if (matchedCode && value !== '') {
                                handleHsnSacSelect(item.id, matchedCode.code);
                              }
                            }}
                            placeholder="Search HSN/SAC code"
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-finance-blue"
                          />
                          <datalist id={`hsn-sac-list-${item.id}`}>
                            {hsnSacCodes
                              .filter(code => {
                                const search = hsnSacSearchTerm[item.id] || '';
                                if (!search) return true;
                                return code.code.toLowerCase().includes(search.toLowerCase()) ||
                                       code.description.toLowerCase().includes(search.toLowerCase());
                              })
                              .map((code) => (
                                <option key={code._id} value={`${code.code} - ${code.description} (${code.gstRate}% GST)`}>
                                  {code.code} - {code.description} ({code.gstRate}% GST)
                                </option>
                              ))}
                          </datalist>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                            placeholder="Item description (optional)"
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-finance-blue"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        onKeyDown={handleNumberInputKeyDown}
                        onWheel={handleNumberInputWheel}
                        step="0.01"
                        min="0"
                        className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-finance-blue"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                        onKeyDown={handleNumberInputKeyDown}
                        onWheel={handleNumberInputWheel}
                        step="0.01"
                        min="0"
                        className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-finance-blue"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) => handleItemChange(item.id, 'discount', e.target.value)}
                          onKeyDown={handleNumberInputKeyDown}
                          onWheel={handleNumberInputWheel}
                          step="0.01"
                          min="0"
                          max="100"
                          className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-finance-blue"
                        />
                        <span className="px-2 py-1.5 text-sm bg-gray-100 border border-l-0 border-gray-300 rounded-r text-gray-600">%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.amount.toFixed(2)}
                        readOnly
                        className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded bg-gray-50 text-gray-700"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="More options"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (items.length > 1) {
                              setDeleteItemConfirm({ show: true, itemId: item.id });
                            } else {
                              // If only one item, show warning and don't delete
                              showToast('At least one item is required. You cannot delete the last item.', 'error');
                            }
                          }}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Delete this item"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleAddItem}
              className="px-3 py-1.5 text-xs font-medium text-finance-blue border border-finance-blue rounded hover:bg-finance-blue hover:text-white transition-colors flex items-center gap-1"
            >
              <span>+</span> Add New Row
            </button>
          </div>
        </div>

        {/* Amount Details - Compact Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column - Input Fields */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <div className={`grid gap-3 ${formData.clientCountry === 'India' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div className={formData.clientCountry === 'India' ? 'col-span-2' : 'col-span-2'}>
                <label className="form-label">Base Amount *</label>
                <input
                  type="number"
                  name="baseAmount"
                  value={formData.baseAmount}
                  onChange={handleChange}
                  onKeyDown={handleNumberInputKeyDown}
                  onWheel={handleNumberInputWheel}
                  step="0.01"
                  placeholder="0.00"
                  className="input-field-compact bg-gray-50"
                  readOnly
                  required={!invoice}
                />
              </div>
              {formData.clientCountry === 'India' && (
                <>
                  <div className="relative" ref={gstDropdownRef}>
                    <label className="form-label">GST %</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="gstPercentage"
                        value={formData.gstPercentage !== undefined && formData.gstPercentage !== null && formData.gstPercentage !== '' 
                          ? (typeof formData.gstPercentage === 'number' 
                              ? Math.round(formData.gstPercentage * 100) / 100 
                              : parseFloat(formData.gstPercentage) || '')
                          : ''}
                        onChange={handleChange}
                        onKeyDown={handleNumberInputKeyDown}
                        onWheel={handleNumberInputWheel}
                        onFocus={() => {
                          if (formData.currency === 'INR') {
                            setOpenGstDropdown(true);
                          }
                        }}
                        step="0.01"
                        placeholder="Select GST %"
                        disabled={formData.currency !== 'INR'}
                        className={`input-field-compact pr-8 ${formData.currency !== 'INR' ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.currency === 'INR') {
                            setOpenGstDropdown(!openGstDropdown);
                          }
                        }}
                        disabled={formData.currency !== 'INR'}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${formData.currency !== 'INR' ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {openGstDropdown && formData.currency === 'INR' && (
                        <div 
                          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {gstRates.map((rate, index) => (
                            <button
                              key={`gst-${index}`}
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Ensure the value is stored as a number without extra precision
                                const gstValue = typeof rate.value === 'number' ? rate.value : parseFloat(rate.value);
                                setFormData({ ...formData, gstPercentage: gstValue });
                                setOpenGstDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                            >
                              <span>{rate.label}</span>
                            </button>
                          ))}
                          <div className="border-t border-gray-200">
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenGstDropdown(false);
                                setShowAddGstModal(true);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-finance-blue hover:bg-blue-50 font-medium flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add 
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative" ref={tdsDropdownRef}>
                    <label className="form-label">TDS %</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="tdsPercentage"
                        value={formData.tdsPercentage || ''}
                        onChange={handleChange}
                        onKeyDown={handleNumberInputKeyDown}
                        onWheel={handleNumberInputWheel}
                        onFocus={() => {
                          if (formData.currency === 'INR') {
                            setOpenTdsDropdown(true);
                          }
                        }}
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="Select TDS %"
                        disabled={formData.currency !== 'INR'}
                        className={`input-field-compact pr-8 ${formData.currency !== 'INR' ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.currency === 'INR') {
                            setOpenTdsDropdown(!openTdsDropdown);
                          }
                        }}
                        disabled={formData.currency !== 'INR'}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${formData.currency !== 'INR' ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {openTdsDropdown && formData.currency === 'INR' && (
                        <div 
                          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {tdsRates.map((rate, index) => (
                            <button
                              key={`tds-${index}`}
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData({ ...formData, tdsPercentage: rate.value });
                                setOpenTdsDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                            >
                              <span>{rate.label}</span>
                            </button>
                          ))}
                          <div className="border-t border-gray-200">
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenTdsDropdown(false);
                                setShowAddTdsModal(true);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-finance-blue hover:bg-blue-50 font-medium flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add 
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className={`grid gap-3 ${formData.clientCountry === 'India' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {formData.clientCountry === 'India' && (
                <div className="relative" ref={tcsDropdownRef}>
                  <label className="form-label">TCS %</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="tcsPercentage"
                      value={formData.tcsPercentage || ''}
                      onChange={handleChange}
                      onKeyDown={handleNumberInputKeyDown}
                      onWheel={handleNumberInputWheel}
                      onFocus={() => {
                        if (formData.currency === 'INR') {
                          setOpenTcsDropdown(true);
                        }
                      }}
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="Select TCS %"
                      disabled={formData.currency !== 'INR'}
                      className={`input-field-compact pr-8 ${formData.currency !== 'INR' ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.currency === 'INR') {
                          setOpenTcsDropdown(!openTcsDropdown);
                        }
                      }}
                      disabled={formData.currency !== 'INR'}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 ${formData.currency !== 'INR' ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openTcsDropdown && (
                      <div 
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {tcsRates.map((rate, index) => (
                          <button
                            key={`tcs-${index}`}
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData({ ...formData, tcsPercentage: rate.value });
                              setOpenTcsDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                          >
                            <span>{rate.label}</span>
                          </button>
                        ))}
                        <div className="border-t border-gray-200">
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenTcsDropdown(false);
                              setShowAddTcsModal(true);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-finance-blue hover:bg-blue-50 font-medium flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add 
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Currency *</label>
                <MobileSelect
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  required
                  className="select-field-compact"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </MobileSelect>
              </div>
              <div>
                <label className="form-label">
                  Exchange Rate
                  {formData.currency !== 'INR' && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type="number"
                  name="exchangeRate"
                  value={formData.exchangeRate}
                  onChange={handleChange}
                  onKeyDown={handleNumberInputKeyDown}
                  onWheel={handleNumberInputWheel}
                  step="0.01"
                  placeholder="1"
                  required={formData.currency !== 'INR'}
                  className="input-field-compact"
                />
              </div>
              <div>
                <label className="form-label">Remittance Charges</label>
                <input
                  type="number"
                  name="remittanceCharges"
                  value={formData.remittanceCharges}
                  onChange={handleChange}
                  onKeyDown={handleNumberInputKeyDown}
                  onWheel={handleNumberInputWheel}
                  step="0.01"
                  placeholder="0.00"
                  className="input-field-compact"
                />
              </div>
            </div>
          </div>

          {/* Right Column - Calculation Summary */}
          <div className="col-span-12 lg:col-span-5">
            <div className={`${invoice ? 'bg-gradient-to-br from-blue-50 to-indigo-50' : 'bg-gray-50'} border ${invoice ? 'border-blue-200' : 'border-gray-200'} rounded-xl p-5 shadow-sm`}>
              <h3 className={`text-sm font-bold ${invoice ? 'text-slate-900' : 'text-gray-800'} mb-4 pb-3 border-b ${invoice ? 'border-blue-200' : 'border-gray-300'} flex items-center gap-2`}>
                {invoice && (
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                Invoice Summary
              </h3>
              <div className="space-y-2">
                {/* Base Amount */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Base Amount:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {formData.currency} {calculatedAmounts.baseAmount.toFixed(2)}
                  </span>
                </div>
                
                {/* GST Display */}
                {formData.clientCountry === 'India' && calculatedAmounts.totalGst > 0 && (
                  <>
                    {calculatedAmounts.isGujarat ? (
                      <>
                        <div className="flex justify-between items-center text-sm pl-2">
                          <span className="text-gray-600">CGST ({((Number(formData.gstPercentage) || 18) / 2).toFixed(0)}%):</span>
                          <span className="text-gray-700">{formData.currency} {calculatedAmounts.cgst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pl-2">
                          <span className="text-gray-600">SGST ({((Number(formData.gstPercentage) || 18) / 2).toFixed(0)}%):</span>
                          <span className="text-gray-700">{formData.currency} {calculatedAmounts.sgst.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center text-sm pl-2">
                        <span className="text-gray-600">IGST ({(Number(formData.gstPercentage) || 18).toFixed(0)}%):</span>
                        <span className="text-gray-700">{formData.currency} {calculatedAmounts.igst.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-gray-300 pt-1 mt-1">
                      <span className="text-sm font-semibold text-gray-700">Total GST:</span>
                      <span className="text-sm font-bold text-gray-900">
                        {formData.currency} {calculatedAmounts.totalGst.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                
                {/* Invoice Total (Base + GST) */}
                <div className="flex justify-between items-center border-t-2 border-gray-400 pt-2 mt-2">
                  <span className="text-sm font-bold text-gray-800">Invoice Total:</span>
                  <span className="text-sm font-bold text-finance-blue">
                    {formData.currency} {calculatedAmounts.invoiceTotal.toFixed(2)}
                  </span>
                </div>
                {/* <p className="text-xs text-gray-500 text-right">(Base + GST)</p> */}
                
                {/* Deductions */}
                {(calculatedAmounts.tdsAmount > 0 || calculatedAmounts.remittanceCharges > 0) && (
                  <div className="pt-2 mt-2 border-t border-gray-300">
                    {calculatedAmounts.tdsAmount > 0 && (
                      <div className="flex justify-between items-center text-sm text-red-600 mb-1">
                        <span>Less: TDS ({formData.tdsPercentage || 0}%):</span>
                        <span>- {formData.currency} {calculatedAmounts.tdsAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {calculatedAmounts.remittanceCharges > 0 && (
                      <div className="flex justify-between items-center text-sm text-red-600">
                        <span>Less: Remittance:</span>
                        <span>- {formData.currency} {calculatedAmounts.remittanceCharges.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Receivable Amount */}
                <div className="flex justify-between items-center border-t-2 border-finance-blue pt-2 mt-2 bg-blue-50 px-3 py-2 rounded">
                  <span className="text-sm font-bold text-gray-800">Receivable Amount:</span>
                  <span className="text-sm font-bold text-finance-blue">
                    {formData.currency} {calculatedAmounts.receivableAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Collapsible Client Details */}
        <div className="border-t border-slate-200 pt-1">
          <button
            type="button"
            onClick={() => setShowClientDetails(!showClientDetails)}
            className="accordion-header w-full"
          >
            <span>Client Details</span>
            <span>{showClientDetails ? '−' : '+'}</span>
          </button>
          <div className={`accordion-content ${showClientDetails ? 'max-h-[700px] mt-1' : 'max-h-0'}`}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="form-label">Client Email *</label>
                <input
                  type="email"
                  name="clientEmail"
                  value={formData.clientEmail}
                  onChange={handleChange}
                  required
                  readOnly={!!selectedCustomerId}
                  className={`input-field-compact ${selectedCustomerId ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  placeholder="Enter client email"
                />
              </div>
              <div>
                <label className="form-label">Client Mobile</label>
                <input
                  type="tel"
                  name="clientMobile"
                  value={formData.clientMobile}
                  onChange={handleChange}
                  placeholder="Enter mobile"
                  className="input-field-compact"
                />
              </div>
              <div>
                <label className="form-label">City</label>
                <input
                  type="text"
                  name="clientCity"
                  value={formData.clientCity}
                  onChange={handleChange}
                  placeholder="Enter city"
                  className="input-field-compact"
                />
              </div>
              {formData.clientCountry === 'India' && (
                <div>
                  <label className="form-label">Client State</label>
                  <MobileSelect
                    name="clientState"
                    value={formData.clientState}
                    onChange={handleChange}
                    className="select-field-compact"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </MobileSelect>
                </div>
              )}
              {formData.clientCountry === 'India' && (
                <div>
                  <label className="form-label">Place of Supply</label>
                  <MobileSelect
                    name="placeOfSupply"
                    value={formData.placeOfSupply}
                    onChange={handleChange}
                    className="select-field-compact"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </MobileSelect>
                </div>
              )}
              {formData.clientCountry === 'India' && (
                <div>
                  <label className="form-label">Client GSTIN</label>
                  <input
                    type="text"
                    name="clientGstin"
                    value={formData.clientGstin}
                    onChange={handleChange}
                    placeholder="Enter GSTIN"
                    className="input-field-compact max-w-full"
                  />
                </div>
              )}
              {formData.clientCountry === 'India' && (
                <div>
                  <label className="form-label">HSN/SAC Code</label>
                  <input
                    type="text"
                    name="hsnSac"
                    value={formData.hsnSac}
                    onChange={handleChange}
                    placeholder="Enter HSN/SAC"
                    className="input-field-compact max-w-full"
                  />
                </div>
              )}
              {formData.clientCountry === 'India' && (
                <div className="relative" ref={gstDropdownRef}>
                  <label className="form-label">GST %</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="gstPercentage"
                      value={formData.gstPercentage}
                      onChange={handleChange}
                      onKeyDown={handleNumberInputKeyDown}
                      onWheel={handleNumberInputWheel}
                      onFocus={() => setOpenGstDropdown(true)}
                      step="0.01"
                      placeholder="0"
                      className="input-field-compact max-w-32 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setOpenGstDropdown(!openGstDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openGstDropdown && (
                      <div 
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {gstRates.map((rate, index) => (
                          <button
                            key={`gst-${index}`}
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Ensure the value is stored as a number without extra precision
                              const gstValue = typeof rate.value === 'number' ? rate.value : parseFloat(rate.value);
                              setFormData({ ...formData, gstPercentage: gstValue });
                              setOpenGstDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                          >
                            <span>{rate.label}</span>
                          </button>
                        ))}
                        <div className="border-t border-gray-200">
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenGstDropdown(false);
                              setShowAddGstModal(true);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-finance-blue hover:bg-blue-50 font-medium flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add 
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {formData.clientCountry === 'India' && (
                <div className="relative" ref={tdsDropdownRef}>
                  <label className="form-label">TDS %</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="tdsPercentage"
                      value={formData.tdsPercentage || ''}
                      onChange={handleChange}
                      onKeyDown={handleNumberInputKeyDown}
                      onWheel={handleNumberInputWheel}
                      onFocus={() => setOpenTdsDropdown(true)}
                      step="0.01"
                      placeholder="Select TDS %"
                      className="input-field-compact max-w-32 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setOpenTdsDropdown(!openTdsDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openTdsDropdown && (
                      <div 
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {tdsRates.map((rate, index) => (
                          <button
                            key={`tds-${index}`}
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData({ ...formData, tdsPercentage: rate.value });
                              setOpenTdsDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                          >
                            <span>{rate.label}</span>
                          </button>
                        ))}
                        <div className="border-t border-gray-200">
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenTdsDropdown(false);
                              setShowAddTdsModal(true);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-finance-blue hover:bg-blue-50 font-medium flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add TDS Rate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {formData.clientCountry === 'India' && (
                <div className="relative" ref={tcsDropdownRef}>
                  <label className="form-label">TCS %</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="tcsPercentage"
                      value={formData.tcsPercentage || ''}
                      onChange={handleChange}
                      onKeyDown={handleNumberInputKeyDown}
                      onWheel={handleNumberInputWheel}
                      onFocus={() => setOpenTcsDropdown(true)}
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="Select TCS %"
                      className="input-field-compact max-w-32 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setOpenTcsDropdown(!openTcsDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openTcsDropdown && (
                      <div 
                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {tcsRates.map((rate, index) => (
                          <button
                            key={`tcs-${index}`}
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData({ ...formData, tcsPercentage: rate.value });
                              setOpenTcsDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                          >
                            <span>{rate.label}</span>
                          </button>
                        ))}
                        <div className="border-t border-gray-200">
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenTcsDropdown(false);
                              setShowAddTcsModal(true);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-finance-blue hover:bg-blue-50 font-medium flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add TCS Rate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Billing Address - At the bottom with single line styling */}
              <div className="col-span-2 mt-4 pt-4 border-t-2 border-gray-300">
                <label className="form-label text-sm font-semibold text-gray-700 mb-2 block flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Billing Address
                </label>
                <input
                  type="text"
                  name="clientAddress"
                  value={formData.clientAddress}
                  onChange={handleChange}
                  placeholder="Enter complete billing address (Street, City, State, Pincode, Country)"
                  className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder:text-gray-400 shadow-sm hover:border-gray-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Additional Information */}
        <div className="border-t border-slate-200 pt-1">
          <button
            type="button"
            onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
            className="accordion-header w-full"
          >
            <span>Additional Information</span>
            <span>{showAdditionalInfo ? '−' : '+'}</span>
          </button>
          <div className={`accordion-content ${showAdditionalInfo ? 'max-h-32 mt-1' : 'max-h-0'}`}>
            <div className="space-y-2">
              <div>
                <label className="form-label">Customer Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="2"
                  placeholder="Thanks for your business."
                  className="input-field-compact resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Add GST Rate Modal */}
        {showAddGstModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Add GST Rate</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Percentage (%)</label>
                  <input
                    type="number"
                    value={newRateValue}
                    onChange={(e) => setNewRateValue(e.target.value)}
                    onKeyDown={handleNumberInputKeyDown}
                    onWheel={handleNumberInputWheel}
                    placeholder="18"
                    step="0.01"
                    min="0"
                    max="100"
                    className="input-field-compact w-full"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter percentage value (e.g., 18 for 18%)</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddGstModal(false);
                    setNewRateValue('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAddRate('gst')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add TDS Rate Modal */}
        {showAddTdsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Add TDS Rate</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Percentage (%)</label>
                  <input
                    type="number"
                    value={newRateValue}
                    onChange={(e) => setNewRateValue(e.target.value)}
                    placeholder="10"
                    step="0.01"
                    min="0"
                    max="100"
                    className="input-field-compact w-full"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter percentage value (e.g., 10 for 10%)</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTdsModal(false);
                    setNewRateValue('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAddRate('tds')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add TCS Rate Modal */}
        {showAddTcsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Add TCS Rate</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Percentage (%)</label>
                  <input
                    type="number"
                    value={newRateValue}
                    onChange={(e) => setNewRateValue(e.target.value)}
                    placeholder="1"
                    step="0.01"
                    min="0"
                    max="100"
                    className="input-field-compact w-full"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter percentage value (e.g., 1 for 1%)</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTcsModal(false);
                    setNewRateValue('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAddRate('tcs')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={`flex justify-end space-x-3 ${invoice ? 'pt-6 mt-6 border-t border-slate-200' : 'pt-3 border-t border-slate-200'}`}>
          <button
            type="button"
            onClick={onCancel}
            className={`${invoice ? 'px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-all duration-200' : 'btn-secondary px-5 py-2 text-sm'}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!invoice && !selectedCustomerId}
            className={`${invoice ? 'px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed' : 'btn-primary px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed'}`}
          >
            {invoice ? 'Update Invoice' : 'Generate Invoice'}
          </button>
        </div>
      </form>

      {/* Delete All Items Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteAllItemsConfirm}
        onClose={() => setDeleteAllItemsConfirm(false)}
        onConfirm={handleDeleteAllItemsConfirm}
        title="Confirm Delete All Items"
        message="Are you sure you want to delete all items? This action cannot be undone."
        confirmText="Delete All"
        cancelText="Cancel"
        confirmButtonColor="red"
      />

      {/* Delete Item Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteItemConfirm.show}
        onClose={() => setDeleteItemConfirm({ show: false, itemId: null })}
        onConfirm={handleDeleteItemConfirm}
        title="Confirm Delete Item"
        message="Are you sure you want to delete this item?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonColor="red"
      />
    </div>
  );
};

export default InvoiceForm;
