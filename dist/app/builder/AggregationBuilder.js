"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizePipeline = summarizePipeline;
const requestContext_1 = require("../logging/requestContext");
// Pure Fluent Aggregation Pipeline Builder for MongoDB / Mongoose
class AggregationBuilder {
    model;
    pipeline = [];
    constructor(model) {
        this.model = model;
    }
    // ====== CORE PIPELINE STAGES ======
    match(conditions) {
        this.pipeline.push({ $match: conditions });
        return this;
    }
    group(groupSpec) {
        this.pipeline.push({ $group: groupSpec });
        return this;
    }
    project(projectSpec) {
        this.pipeline.push({ $project: projectSpec });
        return this;
    }
    sort(sortSpec) {
        this.pipeline.push({ $sort: sortSpec });
        return this;
    }
    limit(limitValue) {
        this.pipeline.push({ $limit: limitValue });
        return this;
    }
    skip(skipValue) {
        this.pipeline.push({ $skip: skipValue });
        return this;
    }
    lookup(lookupSpec) {
        this.pipeline.push({ $lookup: lookupSpec });
        return this;
    }
    unwind(unwindSpec) {
        this.pipeline.push({ $unwind: unwindSpec });
        return this;
    }
    addFields(fieldsSpec) {
        this.pipeline.push({ $addFields: fieldsSpec });
        return this;
    }
    facet(facetSpec) {
        this.pipeline.push({ $facet: facetSpec });
        return this;
    }
    count(fieldName) {
        this.pipeline.push({ $count: fieldName });
        return this;
    }
    addStage(stage) {
        this.pipeline.push(stage);
        return this;
    }
    reset() {
        this.pipeline = [];
        return this;
    }
    getPipeline() {
        return [...this.pipeline];
    }
    async execute() {
        const _start = Date.now();
        const res = await this.model.aggregate(this.pipeline);
        const dur = Date.now() - _start;
        const modelName = this.model?.modelName ||
            this.model?.collection?.name ||
            'UnknownModel';
        const pipelineSummary = summarizePipeline(this.pipeline);
        (0, requestContext_1.recordDbQuery)(dur, {
            model: modelName,
            operation: 'aggregate',
            cacheHit: false,
            pipeline: pipelineSummary,
        });
        return res;
    }
}
// Compact summary generator for aggregation pipeline metrics logging
function summarizePipeline(pipeline) {
    const parts = [];
    for (const stage of pipeline) {
        const key = stage && typeof stage === 'object'
            ? Object.keys(stage)[0]
            : undefined;
        if (!key)
            continue;
        const val = stage[key];
        switch (key) {
            case '$match': {
                const conds = val && typeof val === 'object' ? Object.keys(val) : [];
                const firstKey = conds[0];
                let display = `$match`;
                if (firstKey) {
                    const v = val[firstKey];
                    const repr = typeof v === 'object' ? JSON.stringify(v) : String(v);
                    display = `$match(${firstKey}=${repr})`;
                }
                parts.push(display);
                break;
            }
            case '$group': {
                const idVal = val?._id !== undefined ? val._id : undefined;
                const idRepr = idVal !== undefined ? String(idVal) : undefined;
                parts.push(idRepr ? `$group(_id='${idRepr}')` : `$group`);
                break;
            }
            case '$sort': {
                const keys = val && typeof val === 'object' ? Object.keys(val) : [];
                parts.push(keys.length ? `$sort(${keys.join(',')})` : `$sort`);
                break;
            }
            case '$project': {
                const keys = val && typeof val === 'object' ? Object.keys(val) : [];
                parts.push(keys.length ? `$project(${keys.length} fields)` : `$project`);
                break;
            }
            case '$lookup': {
                const from = val?.from ? String(val.from) : undefined;
                parts.push(from ? `$lookup(from='${from}')` : `$lookup`);
                break;
            }
            case '$facet': {
                const facets = val && typeof val === 'object' ? Object.keys(val) : [];
                parts.push(`$facet(${facets.join(',')})`);
                break;
            }
            default:
                parts.push(key);
        }
    }
    return parts.join(' → ');
}
exports.default = AggregationBuilder;
//# sourceMappingURL=AggregationBuilder.js.map