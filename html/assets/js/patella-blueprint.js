/* ==========================================================================
   PATELLA — SUPPLY CHAIN, ROUTE CUSTODY & PAYMENT PLAN ENGINE
   Based on Patela Product, Page Architecture & UX Blueprint v1.0 (Nov 2026)
   Implements:
   - Route-agnostic multi-hop route graph & parcel tracking
   - Versioned agreements, route plans & payment plans with canonical hashing
   - Conservation of money (Exact sum validation in ZAR)
   - Two-party guest handoff verification (GST-01, GST-02, GST-03)
   - Tender Trail (TEN-01) sealed bidding & scoring
   - Isolated dispute holding (holding only affected parcel funds)
   - Double-entry ledger with Available / Locked / Payable rand buckets
   - Forensic audit trail with on-chain anchor proofs & live byte hash verifier
   ========================================================================== */

(function () {
  'use strict';

  const BLUEPRINT_STORAGE_KEY = 'patela_blueprint_state_v1';

  // Default seed data following the recommended demo narrative
  const DEFAULT_BLUEPRINT_STATE = {
    currentRole: 'buyer', // 'buyer' | 'supplier' | 'partner' | 'ops' | 'auditor'
    userOrganisation: {
      name: 'Anglo-Bavarian Mineral Trade (Pty) Ltd',
      regNumber: '2021/894012/07',
      vatNumber: 'ZA4910284712',
      country: 'South Africa',
      kybStatus: 'Verified', // 'Verified' | 'Pending review' | 'Action needed' | 'Restricted'
      kybLastUpdated: '2026-11-10 11:30 SAST',
      settlementPartner: 'Standard Bank South Africa (Licensed FSP #11287)',
      settlementTrustAccount: 'PATELA-TRUST-9941-SBSA',
      escrowContract: '0x84532B5e7834571A914856a938D4d6a894B83e20',
      network: 'Base Sepolia (Testnet)'
    },

    // Wallet & Rand Balance Buckets (PAY-03)
    balances: {
      currency: 'ZAR',
      available: 184200.00,
      lockedInEscrow: 485000.00,
      payablePending: 145500.00,
      totalDeposited: 814700.00,
      settlementToken: 'USDC / ZARP',
      tokenEquivalent: '26,500 USDC'
    },

    // Primary Demo Order (ORD-01, ORD-02, SHIP-01)
    primaryOrder: {
      id: 'ORD-2026-8941',
      title: 'Bulk Industrial Bauxite Delivery (Richards Bay → City Deep)',
      referenceNumber: 'RFQ-MIN-8941',
      createdDate: '2026-11-08 09:30 SAST',
      totalZar: 485000.00,
      orderState: 'Active', // 'Created' | 'Funded' | 'Active' | 'Completed' | 'Disputed' | 'Resolved'
      shipmentState: 'In Transit · Leg 2 of 3',
      paymentState: 'Tranche 2 Releasable · R 145,500 Pending Approval',
      buyer: {
        company: 'Anglo-Bavarian Mineral Trade (Pty) Ltd',
        contact: 'Alex Morgan (Procurement Director)',
        wallet: '0x71c4b8209f31d8e44019ca2b5580e91124009a2e',
        signed: true,
        signedAt: '2026-11-10 14:22 SAST'
      },
      supplier: {
        company: 'Highveld Logistics & Mining Consumables (Pty) Ltd',
        contact: 'Marcus Khumalo (Managing Director)',
        wallet: '0x94b8e1204c78a9d11038fb4c2291a80053103e1f',
        signed: true,
        signedAt: '2026-11-10 15:05 SAST'
      },
      agreement: {
        version: 'v1.2 (Signed Canonical)',
        hash: '0x8b3f2e41c981a7b8e5d0342981fae629471bb9c08472518e2a391c4d9a8e0f12',
        anchorBlock: 19482103,
        anchorTx: '0xfa3910c841bb28941da7e0129bc841289c0172e94819cae1938a192837bcda12',
        incoterms: 'DAP (Delivered at Place, City Deep)',
        contractType: 'Multi-Hop Custody Escrow with Isolated Parcel Tranches',
        cargoDescription: '120 Metric Tons High-Grade Industrial Bauxite Ore (Moisture Content <= 4.2%)',
        declaredValueZar: 485000.00
      },

      // Parcels for Split-Shipment & Isolated Disputes
      parcels: [
        {
          id: 'PCL-8941-A',
          label: 'Parcel A · Bulk Consignment (80 MT)',
          quantity: '80 Metric Tons',
          destinationNode: 'NODE-03 (City Deep Depot)',
          status: 'In Transit', // 'Created' | 'In Transit' | 'Delivered' | 'Accepted' | 'Disputed'
          custodyHolder: 'Trans-Kalahari Express (Driver Thabo M.)',
          disputed: false,
          allocatedZar: 363750.00
        },
        {
          id: 'PCL-8941-B',
          label: 'Parcel B · Reserve Consignment (40 MT)',
          quantity: '40 Metric Tons',
          destinationNode: 'NODE-04 (Pretoria East Warehouse)',
          status: 'Disputed · Damaged Seal',
          custodyHolder: 'Durban Bonded Terminal Hub',
          disputed: true,
          disputeId: 'DIS-2026-041',
          allocatedZar: 121250.00
        }
      ],

      // Multi-hop Route Graph (ROUTE-01)
      route: {
        version: 'v1.2',
        template: 'Multi-Hop Freight with Transit Hub',
        nodes: [
          {
            id: 'NODE-01',
            type: 'Origin / Mine',
            name: 'Richards Bay Bauxite Extraction Plant',
            location: 'Richards Bay, KwaZulu-Natal',
            responsibleParty: 'Highveld Logistics (Supplier)',
            proofLevel: 'Dual QR Scan + Weighbridge Certificate',
            status: 'Completed',
            completedAt: '2026-11-11 08:30 SAST'
          },
          {
            id: 'NODE-02',
            type: 'Transit Hub',
            name: 'Durban Inland Logistics Hub (Terminal 4)',
            location: 'Bayhead, Durban, KZN',
            responsibleParty: 'Durban Bonded Hub Services',
            proofLevel: 'Two-Party Guest Signature + Tamper Seal Photo',
            status: 'Completed',
            completedAt: '2026-11-12 14:15 SAST'
          },
          {
            id: 'NODE-03',
            type: 'Destination Checkpoint',
            name: 'City Deep Container Terminal (Depot A)',
            location: 'Johannesburg, Gauteng',
            responsibleParty: 'Anglo-Bavarian Receiving Team',
            proofLevel: 'Two-Party Guest Signature + Consignee Seal Check',
            status: 'In Progress · Awaiting Delivery Handoff',
            completedAt: null
          },
          {
            id: 'NODE-04',
            type: 'Secondary Destination',
            name: 'Pretoria East Industrial Warehouse',
            location: 'Silverton, Pretoria, Gauteng',
            responsibleParty: 'Trans-Logistics Distribution Center',
            proofLevel: 'Two-Party Guest Signature + Weight Slip Verification',
            status: 'Held · Disputed Seal Exception',
            completedAt: null
          }
        ],
        legs: [
          {
            id: 'LEG-01',
            fromNode: 'NODE-01',
            toNode: 'NODE-02',
            carrier: 'Trans-Kalahari Haulage Ltd',
            mode: 'Heavy Road Haulage (34-Ton Interlink)',
            status: 'Completed',
            completedAt: '2026-11-12 14:15 SAST'
          },
          {
            id: 'LEG-02',
            fromNode: 'NODE-02',
            toNode: 'NODE-03',
            carrier: 'Vanguard Freight Rail & Road',
            mode: 'Intermodal Freight',
            status: 'In Transit',
            completedAt: null
          },
          {
            id: 'LEG-03',
            fromNode: 'NODE-02',
            toNode: 'NODE-04',
            carrier: 'Durban Express Drayage',
            mode: 'Bonded Road Carrier',
            status: 'Held Pending Dispute Resolution',
            completedAt: null
          }
        ]
      },

      // Payment Plan Builder with Live Sum Conservation (PAY-01)
      paymentPlan: {
        version: 'v1.2',
        escrowTotalZar: 485000.00,
        currency: 'ZAR',
        ruleSummary: 'Payment released in 4 tranches tied to verified physical handoffs and final consignee acceptance. Money conserved: sum of tranches equals escrow total exactly.',
        tranches: [
          {
            id: 'TR-01',
            name: 'Tranche 1: Mobilization & Origin Weighbridge Dispatch',
            percentage: 20,
            amountZar: 97000.00,
            payee: 'Highveld Logistics (Supplier)',
            payeeWallet: '0x94b8e1204c78a9d11038fb4c2291a80053103e1f',
            trigger: 'Origin Dispatch Handoff Confirmed',
            condition: 'Both parties sign dispatch receipt + weighbridge slip uploaded',
            responseWindow: '24 hours',
            status: 'Released', // 'Locked' | 'Releasable' | 'Released' | 'Refunded' | 'Held'
            releasedAt: '2026-11-11 09:15 SAST',
            txHash: '0x41ab982c7104b20194819da2918bc401928419cae1938a192837bcda894121a1'
          },
          {
            id: 'TR-02',
            name: 'Tranche 2: Durban Inland Hub Waypoint Handoff',
            percentage: 30,
            amountZar: 145500.00,
            payee: 'Highveld Logistics & Trans-Kalahari',
            payeeWallet: '0x94b8e1204c78a9d11038fb4c2291a80053103e1f',
            trigger: 'Durban Hub Inward Custody Confirmed (Node 02)',
            condition: 'Driver & Terminal operator complete two-party cryptographic handoff',
            responseWindow: '48 hours (Auto-releases on window elapsed if no dispute)',
            status: 'Releasable',
            releasedAt: null,
            txHash: null
          },
          {
            id: 'TR-03',
            name: 'Tranche 3: Parcel A Delivery at City Deep Depot',
            percentage: 25,
            amountZar: 121250.00,
            payee: 'Highveld Logistics (Supplier)',
            payeeWallet: '0x94b8e1204c78a9d11038fb4c2291a80053103e1f',
            trigger: 'Parcel A Destination Handoff Signed',
            condition: 'Consignee signs receiver side of guest handoff token',
            responseWindow: '72 hours',
            status: 'Locked',
            releasedAt: null,
            txHash: null
          },
          {
            id: 'TR-04',
            name: 'Tranche 4: Final Consignee Acceptance & Parcel B Settlement',
            percentage: 25,
            amountZar: 121250.00,
            payee: 'Highveld Logistics (Supplier)',
            payeeWallet: '0x94b8e1204c78a9d11038fb4c2291a80053103e1f',
            trigger: 'All Parcels Delivered & Delivery Accepted by Buyer',
            condition: 'Mandatory final acceptance check. Parcel B dispute resolution required before release.',
            responseWindow: '5 business days',
            status: 'Held',
            releasedAt: null,
            txHash: null
          }
        ]
      },

      // Escrow Funding Lifecycle (PAY-02)
      escrowFunding: {
        stage: 5, // 1 to 5
        stageName: 'Escrow Locked in Base Sepolia Vault',
        amountDueZar: 485000.00,
        licensedPartner: 'Standard Bank Corporate Settlement & Luno Custody',
        depositReference: 'PAT-EFT-8941-ZAR',
        timeline: [
          { step: 1, name: 'Deposit Initiated', time: '2026-11-09 10:15 SAST', status: 'Completed', detail: 'EFT transfer initiated from Anglo-Bavarian Business Account' },
          { step: 2, name: 'Rand Received by Licensed Partner', time: '2026-11-09 11:40 SAST', status: 'Completed', detail: 'R 485,000 cleared in Standard Bank client trust escrow account' },
          { step: 3, name: 'Conversion Pending', time: '2026-11-09 12:05 SAST', status: 'Completed', detail: 'ZAR converted to 26,500 USDC via authorized liquidity venue' },
          { step: 4, name: 'Stablecoin Received in Gateway', time: '2026-11-09 12:20 SAST', status: 'Completed', detail: 'Token mint acknowledged by settlement relayer' },
          { step: 5, name: 'Escrow Locked in Smart Contract', time: '2026-11-09 12:35 SAST', status: 'Completed', detail: 'Vault contract locked 26,500 USDC on Base Sepolia (Tx 0x81c4…)' }
        ],
        feeBreakdown: {
          settlementFeeZar: 1697.50, // 0.35%
          conversionMarginZar: 727.50, // 0.15%
          networkGasZar: 0.00, // subsidized
          totalFeesZar: 2425.00
        }
      }
    },

    // Tender Trail (TEN-01) RFQ & Sealed Bids
    tenderTrail: {
      rfqId: 'RFQ-MIN-8941',
      title: 'Road & Rail Freight Procurement: Richards Bay to Gauteng Corridor',
      status: 'Awarded · Converted to ORD-2026-8941',
      deadline: '2026-11-09 17:00 SAST (Closed)',
      scoringRubric: [
        { criterion: 'Price / Ton-KM Rate Card', weight: 40 },
        { criterion: 'Transit Time & Guaranteed Capacity', weight: 30 },
        { criterion: 'Vetting & Confirmed Handoff Rating', weight: 30 }
      ],
      bids: [
        {
          id: 'BID-01',
          supplierName: 'Highveld Logistics & Mining Consumables',
          status: 'Awarded & Signed',
          priceZar: 485000.00,
          leadTime: '48 Hours',
          score: 94.5,
          sealedUntilDeadline: true,
          decryptedAt: '2026-11-09 17:01 SAST',
          fleetSummary: '6x 34-Ton Tri-Axle Interlinks with active satellite telematics'
        },
        {
          id: 'BID-02',
          supplierName: 'Kalahari Bulk Hauliers (Pty) Ltd',
          status: 'Runner Up',
          priceZar: 512000.00,
          leadTime: '72 Hours',
          score: 87.2,
          sealedUntilDeadline: true,
          decryptedAt: '2026-11-09 17:01 SAST',
          fleetSummary: '4x Superlink tippers'
        },
        {
          id: 'BID-03',
          supplierName: 'Durban Coastal Drayage Ltd',
          status: 'Disqualified (Incomplete Insurance)',
          priceZar: 460000.00,
          leadTime: '96 Hours',
          score: 62.0,
          sealedUntilDeadline: true,
          decryptedAt: '2026-11-09 17:01 SAST',
          fleetSummary: 'Third-party sub-contracted fleet'
        }
      ]
    },

    // Active Two-Party Guest Handoff Link State (GST-01, GST-02, GST-03)
    guestHandoff: {
      token: 'gst_live_8941_leg2',
      isValid: true,
      isExpired: false,
      shipmentRef: 'SHP-99201 (ORD-2026-8941)',
      nodeName: 'City Deep Container Terminal (Depot A)',
      nodeId: 'NODE-03',
      parcelRef: 'Parcel A · Bulk Consignment (80 MT)',
      giver: {
        title: 'Carrier Driver (Consignor)',
        name: 'Thabo Molefe',
        company: 'Trans-Kalahari Haulage Ltd',
        signed: true,
        signedAt: '2026-11-12 17:45 SAST',
        signatureHash: '0x39a1c028e4…7129bc'
      },
      receiver: {
        title: 'Receiving Depot Supervisor (Consignee)',
        name: 'Sarah Khanyile',
        company: 'Anglo-Bavarian Depot Receiving',
        signed: false,
        signedAt: null,
        signatureHash: null
      },
      cargoDeclaredNote: '80 MT bauxite in 2 sealed bulk tippers. Tamper seals #RB-99411 and #RB-99412 intact.',
      photoEvidenceUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
      proofHash: '0x1e8471289c0172e94819cae1938a192837bcda124819a820c7104b20194819da',
      jointConfirmationTime: null,
      releasableTrancheNotice: 'Upon joint confirmation, Tranche 2 (R 145,500.00) becomes releasable in payment plan.'
    },

    // Isolated Dispute Centre (DIS-01, OPS-02)
    disputes: [
      {
        id: 'DIS-2026-041',
        orderId: 'ORD-2026-8941',
        parcelId: 'PCL-8941-B',
        title: 'Tamper Seal Broken & Partial Moisture Contamination on Parcel B',
        affectedAmountZar: 121250.00, // Isolated: unaffected R 363,750 continues!
        unaffectedAmountZar: 363750.00,
        status: 'Under Review · Settlement Proposal Prepared', // 'Open' | 'Under Review' | 'Resolved'
        openedBy: 'Anglo-Bavarian Logistics Officer (Dave M.)',
        openedDate: '2026-11-12 11:20 SAST',
        reasonCategory: 'Cargo Damage / Tamper Seal Breach',
        responseDeadline: '2026-11-14 17:00 SAST (48 Hours)',
        assignedReviewer: 'Nomvula Sithole (Senior Operations Arbitrator)',
        description: 'During inspection at Durban Inland Hub, container seal #RB-99413 was found severed. Lab moisture test indicated 8.6% moisture (contract maximum: 4.2%). Parcel A is unaffected and cleared.',
        evidenceFiles: [
          { name: 'seal_breach_photo_01.jpg', hash: '0x9924a…81c2', size: '2.4 MB' },
          { name: 'lab_moisture_analysis.pdf', hash: '0x5510b…442a', size: '480 KB' },
          { name: 'weighbridge_discrepancy_log.pdf', hash: '0x7182c…991e', size: '1.1 MB' }
        ],
        proposedSettlement: {
          releaseToSupplierZar: 72750.00, // 60%
          refundToBuyerZar: 48500.00,     // 40%
          rationale: 'Supplier accepted responsibility for secondary tarp failure; buyer agrees to take delivery at discounted processing rate.'
        }
      }
    ],

    // Vetted Partner Directory (PART-01, PART-02)
    partners: [
      {
        id: 'PRT-101',
        companyName: 'Trans-Kalahari Haulage & Intermodal (Pty) Ltd',
        regNumber: '2018/491029/07',
        services: ['Heavy Road Freight', 'Intermodal Container Haulage', 'Cross-Border SADC Corridor'],
        serviceAreas: ['KwaZulu-Natal', 'Gauteng', 'Mpumalanga', 'Botswana Corridors'],
        rateCardVersion: 'v2026.3 (Standard Heavy Freight Rate)',
        insurancePolicyNumber: 'MUTUAL-FREIGHT-88201 (R 20M Cargo in Transit)',
        insuranceExpiry: '2027-04-30',
        kybVerified: true,
        vettingStatus: 'Fully Approved',
        confirmedHandoffs: 342,
        onTimeRate: '98.8%',
        samplePeriod: 'Last 12 Months (342 Confirmed Handoffs)'
      },
      {
        id: 'PRT-102',
        companyName: 'Durban Bonded Terminal & Hub Services',
        regNumber: '2015/019284/07',
        services: ['Bonded Warehousing', 'Container Depot Staging', 'Tamper Seal Inspection'],
        serviceAreas: ['Port of Durban Bayhead', 'Maydon Wharf'],
        rateCardVersion: 'v2026.1 (Bonded Storage Rate)',
        insurancePolicyNumber: 'SANLAM-WHSE-91820 (R 50M Public & Cargo Liability)',
        insuranceExpiry: '2027-01-15',
        kybVerified: true,
        vettingStatus: 'Fully Approved',
        confirmedHandoffs: 890,
        onTimeRate: '99.4%',
        samplePeriod: 'Last 24 Months'
      },
      {
        id: 'PRT-103',
        companyName: 'Highveld Express Drayage (Pty) Ltd',
        regNumber: '2022/948192/07',
        services: ['Gauteng Last-Mile Delivery', 'Industrial Railhead Shunting'],
        serviceAreas: ['Johannesburg City Deep', 'Pretoria Silverton', 'Ekurhuleni'],
        rateCardVersion: 'v2026.2 (Regional Drayage)',
        insurancePolicyNumber: 'HOLLARD-CIT-41920 (R 10M Cargo in Transit)',
        insuranceExpiry: '2026-12-31',
        kybVerified: true,
        vettingStatus: 'Fully Approved',
        confirmedHandoffs: 184,
        onTimeRate: '97.2%',
        samplePeriod: 'Last 6 Months'
      }
    ],

    // Documents & Cryptographic Hashes (DOC-01, AUD-02)
    documents: [
      {
        id: 'DOC-8941-01',
        name: 'commercial_tax_invoice_inv8941.pdf',
        category: 'Commercial Invoice',
        uploader: 'Highveld Logistics Accounts',
        timestamp: '2026-11-10 10:15 SAST',
        fileSizeBytes: 428190,
        sha256Hash: '0x8f3c7e419b02a7b8e5d0342981fae629471bb9c08472518e2a391c4d9a8e0f12',
        onChainAnchorBlock: 19482103,
        aiExtraction: {
          detectedAmountZar: 485000.00,
          detectedGoods: '120 MT Bauxite Ore',
          detectedIncoterm: 'DAP City Deep',
          isAdvisoryOnly: true,
          disclaimer: 'AI extraction is an advisory suggestion only and does not alter canonical agreement terms without human confirmation.'
        }
      },
      {
        id: 'DOC-8941-02',
        name: 'weighbridge_certificate_mine_node01.pdf',
        category: 'Inspection & Weight Certificate',
        uploader: 'Richards Bay Weighbridge Operator',
        timestamp: '2026-11-11 08:35 SAST',
        fileSizeBytes: 184200,
        sha256Hash: '0x41ab982c7104b20194819da2918bc401928419cae1938a192837bcda894121a1',
        onChainAnchorBlock: 19482450,
        aiExtraction: null
      },
      {
        id: 'DOC-8941-03',
        name: 'two_party_guest_handoff_receipt_leg1.pdf',
        category: 'Handoff Event Receipt',
        uploader: 'Patela Automated Custody Notary',
        timestamp: '2026-11-12 14:18 SAST',
        fileSizeBytes: 98450,
        sha256Hash: '0x1e8471289c0172e94819cae1938a192837bcda124819a820c7104b20194819da',
        onChainAnchorBlock: 19483012,
        aiExtraction: null
      }
    ],

    // Operations Console Data (OPS-01 to OPS-05)
    operations: {
      systemHealth: {
        rampStatus: 'Operational · Standard Bank Open API v2.4',
        chainGateway: 'Operational · Base Sepolia Gateway latency 182ms',
        eventBus: 'Healthy · BullMQ zero backlog',
        settlementReconciliation: 'Synced (0 discrepancies)'
      },
      queues: {
        kybPendingCount: 2,
        openDisputesCount: 1,
        handoffExceptionsCount: 1,
        reconciliationAlertsCount: 0
      },
      contractGovernance: {
        contractAddress: '0x84532B5e7834571A914856a938D4d6a894B83e20',
        network: 'Base Sepolia (Chain ID 84532)',
        isPaused: false,
        pauseReason: null,
        operatorKeyDisclosure: 'MVP Operator-Held Release Authority with HSM audit logging',
        lastAuditDate: '2026-11-09 by OpenZeppelin Testnet Baseline Suite'
      }
    }
  };

  function loadBlueprintState() {
    try {
      const raw = localStorage.getItem(BLUEPRINT_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(BLUEPRINT_STORAGE_KEY, JSON.stringify(DEFAULT_BLUEPRINT_STATE));
        return JSON.parse(JSON.stringify(DEFAULT_BLUEPRINT_STATE));
      }
      const parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_BLUEPRINT_STATE, parsed);
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_BLUEPRINT_STATE));
    }
  }

  function saveBlueprintState(state) {
    try {
      localStorage.setItem(BLUEPRINT_STORAGE_KEY, JSON.stringify(state));
      // Dispatch storage event for reactive UI updates
      window.dispatchEvent(new CustomEvent('patela:blueprint-updated', { detail: state }));
    } catch (e) {
      console.warn('Could not save Patela blueprint state to localStorage', e);
    }
  }

  function resetBlueprintState() {
    localStorage.setItem(BLUEPRINT_STORAGE_KEY, JSON.stringify(DEFAULT_BLUEPRINT_STATE));
    window.dispatchEvent(new CustomEvent('patela:blueprint-updated', { detail: DEFAULT_BLUEPRINT_STATE }));
    return JSON.parse(JSON.stringify(DEFAULT_BLUEPRINT_STATE));
  }

  // Live currency formatting helper for exact South African Rand display
  function formatZar(amount) {
    const num = Number(amount) || 0;
    return 'R ' + num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Cryptographic SHA-256 in browser
  async function sha256String(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function sha256File(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Public API attached to window.PatelaBlueprint
  window.PatelaBlueprint = {
    getState: loadBlueprintState,
    saveState: saveBlueprintState,
    resetState: resetBlueprintState,
    formatZar: formatZar,
    sha256String: sha256String,
    sha256File: sha256File,

    // Switch active role: 'buyer', 'supplier', 'partner', 'ops', 'auditor'
    setRole: function (role) {
      const state = loadBlueprintState();
      state.currentRole = role;
      saveBlueprintState(state);
      return role;
    },

    getRole: function () {
      return loadBlueprintState().currentRole || 'buyer';
    },

    // Confirm receiver side of guest handoff
    confirmGuestReceiver: function (signedByName) {
      const state = loadBlueprintState();
      const now = new Date();
      const timeStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ' SAST';

      state.guestHandoff.receiver.signed = true;
      state.guestHandoff.receiver.name = signedByName || 'Sarah Khanyile (Consignee)';
      state.guestHandoff.receiver.signedAt = timeStr;
      state.guestHandoff.receiver.signatureHash = '0x81fa92c018e7…4419ad';
      state.guestHandoff.jointConfirmationTime = timeStr;

      // Make Tranche 2 releasable in payment plan
      const tr2 = state.primaryOrder.paymentPlan.tranches.find(t => t.id === 'TR-02');
      if (tr2 && tr2.status === 'Locked') {
        tr2.status = 'Releasable';
      }

      saveBlueprintState(state);
      return state.guestHandoff;
    },

    // Authorize release of a releasable tranche
    releaseTranche: function (trancheId) {
      const state = loadBlueprintState();
      const tranche = state.primaryOrder.paymentPlan.tranches.find(t => t.id === trancheId);
      if (!tranche) return null;

      const now = new Date();
      tranche.status = 'Released';
      tranche.releasedAt = now.toISOString();
      tranche.txHash = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      // Update balances (deduct from locked, add to payable/released)
      state.balances.lockedInEscrow = Math.max(0, state.balances.lockedInEscrow - tranche.amountZar);
      state.balances.payablePending = Math.max(0, state.balances.payablePending - tranche.amountZar);

      saveBlueprintState(state);
      return tranche;
    },

    // Resolve a dispute with split/refund allocations
    resolveDispute: function (disputeId, releaseToSupplierZar, refundToBuyerZar, rationale) {
      const state = loadBlueprintState();
      const dispute = state.disputes.find(d => d.id === disputeId);
      if (!dispute) return null;

      dispute.status = 'Resolved';
      dispute.proposedSettlement = {
        releaseToSupplierZar: Number(releaseToSupplierZar),
        refundToBuyerZar: Number(refundToBuyerZar),
        rationale: rationale || 'Mutual agreement recorded by authorized dispute arbitrator.'
      };

      // Unfreeze affected parcel
      const parcel = state.primaryOrder.parcels.find(p => p.id === dispute.parcelId);
      if (parcel) {
        parcel.status = 'Resolved · Partial Settlement';
        parcel.disputed = false;
      }

      saveBlueprintState(state);
      return dispute;
    },

    // Validate Payment Plan Invariant: Sum of tranches == Escrow Total
    validatePaymentPlan: function (tranches, totalZar) {
      const sum = tranches.reduce((acc, t) => acc + (Number(t.amountZar) || 0), 0);
      const diff = Math.abs(sum - Number(totalZar));
      const hasFinalAcceptance = tranches.some(t =>
        (t.trigger && t.trigger.toLowerCase().includes('acceptance')) ||
        (t.condition && t.condition.toLowerCase().includes('acceptance'))
      );

      return {
        sum: sum,
        total: Number(totalZar),
        isValid: diff < 0.01 && hasFinalAcceptance,
        diffZar: sum - Number(totalZar),
        hasFinalAcceptance: hasFinalAcceptance,
        errorMessage: diff >= 0.01
          ? 'Tranche sum (' + formatZar(sum) + ') must exactly equal escrow total (' + formatZar(totalZar) + '). Difference: ' + formatZar(sum - totalZar)
          : (!hasFinalAcceptance ? 'Mandatory rule: At least one tranche must be tied to final consignee delivery acceptance.' : null)
      };
    }
  };
})();
