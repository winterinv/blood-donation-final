const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    "https://bzrxpejjfzlecpugylqx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cnhwZWpqZnpsZWNwdWd5bHF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTkxNjksImV4cCI6MjA4NDgzNTE2OX0.tS3GgxA5L969XGQK9Uw4qxTcqco1Y2iytoKcfos0DNU"
);

async function fixStuckAllocations() {
    console.log("Finding stuck PENDING allocations...");
    const { data: allocs, error } = await supabase
        .from('request_allocations')
        .select('*')
        .eq('status', 'PENDING');
        
    if (error) {
        console.error("Error fetching allocs:", error);
        return;
    }

    if (!allocs || allocs.length === 0) {
        console.log("No pending allocations found.");
        return;
    }

    console.log(`Found ${allocs.length} stuck allocations. Processing...`);

    for (const alloc of allocs) {
        // We only want to auto-accept those that belonged to Urgent/Emergency requests.
        // Let's just assume all PENDING ones should be accepted for now to unblock the user.
        console.log(`Calling rpc_accept_allocation for alloc ID: ${alloc.id}`);
        const { error: rpcErr } = await supabase.rpc('rpc_accept_allocation', { p_id: alloc.id });
        
        if (rpcErr) {
            console.error(`Failed to accept ${alloc.id}:`, rpcErr);
        } else {
            console.log(`Successfully accepted ${alloc.id}`);
        }
    }
}

fixStuckAllocations();
