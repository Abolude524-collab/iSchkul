const { Pinecone } = require('@pinecone-database/pinecone');

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});

// Guard: ensure index name configured to avoid runtime errors
const INDEX_NAME = process.env.PINECONE_INDEX;
let index;
try {
    if (INDEX_NAME) {
        index = pinecone.index(INDEX_NAME);
    } else {
        console.warn('[vectorDB] ⚠️  PINECONE_INDEX is not set. Vector upserts/queries will be skipped.');
    }
} catch (err) {
    console.warn('[vectorDB] ⚠️  Failed to initialize Pinecone index:', err?.message);
}

exports.upsertVectors = async (vectors, namespace) => {
    try {
        if (!index) {
            console.warn('[vectorDB] ⚠️  Skipping upsert: Pinecone index not configured');
            return false;
        }
        await index.namespace(namespace).upsert(vectors);
        return true;
    } catch (error) {
        console.error('Pinecone upsert error:', error);
        return false;
    }
};

exports.queryVectors = async (vector, namespace, topK = 5, filter = {}) => {
    try {
        if (!index) {
            console.warn('[vectorDB] ⚠️  Skipping query: Pinecone index not configured');
            return [];
        }
        const queryOptions = {
            vector,
            topK,
            includeMetadata: true,
        };

        if (filter && Object.keys(filter).length > 0) {
            queryOptions.filter = filter;
        }

        const queryResponse = await index.namespace(namespace).query(queryOptions);
        return queryResponse.matches;
    } catch (error) {
        console.error('Pinecone query error:', error);
        return [];
    }
};
