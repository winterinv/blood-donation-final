const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    "https://bzrxpejjfzlecpugylqx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cnhwZWpqZnpsZWNwdWd5bHF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNTkxNjksImV4cCI6MjA4NDgzNTE2OX0.tS3GgxA5L969XGQK9Uw4qxTcqco1Y2iytoKcfos0DNU"
);

async function run() {
    const { data, error } = await supabase
        .from('inventory_batches')
        .update({ expiry_date: '2026-12-31T00:00:00' })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // update all
        
    if (error) console.error("Error updating:", error);
    else console.log("Successfully extended expiry dates.");
}
run();
