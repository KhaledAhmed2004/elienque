import { Model, PipelineStage } from 'mongoose';
import { recordDbQuery } from '../logging/requestContext';

// Pure Fluent Aggregation Pipeline Builder for MongoDB / Mongoose
class AggregationBuilder<T> {
  private model: Model<T>;
  private pipeline: PipelineStage[] = [];

  constructor(model: Model<T>) {
    this.model = model;
  }

  // ====== CORE PIPELINE STAGES ======

  match(conditions: Record<string, any>): this {
    this.pipeline.push({ $match: conditions });
    return this;
  }

  group(groupSpec: Record<string, any>): this {
    this.pipeline.push({ $group: groupSpec });
    return this;
  }

  project(projectSpec: Record<string, any>): this {
    this.pipeline.push({ $project: projectSpec });
    return this;
  }

  sort(sortSpec: Record<string, any>): this {
    this.pipeline.push({ $sort: sortSpec });
    return this;
  }

  limit(limitValue: number): this {
    this.pipeline.push({ $limit: limitValue });
    return this;
  }

  skip(skipValue: number): this {
    this.pipeline.push({ $skip: skipValue });
    return this;
  }

  lookup(lookupSpec: {
    from: string;
    localField?: string;
    foreignField?: string;
    as: string;
    pipeline?: PipelineStage[];
    let?: Record<string, any>;
  }): this {
    this.pipeline.push({ $lookup: lookupSpec as any });
    return this;
  }

  unwind(
    unwindSpec: string | { path: string; preserveNullAndEmptyArrays?: boolean },
  ): this {
    this.pipeline.push({ $unwind: unwindSpec });
    return this;
  }

  addFields(fieldsSpec: Record<string, any>): this {
    this.pipeline.push({ $addFields: fieldsSpec });
    return this;
  }

  facet(facetSpec: Record<string, PipelineStage.FacetPipelineStage[]>): this {
    this.pipeline.push({ $facet: facetSpec } as PipelineStage);
    return this;
  }

  count(fieldName: string): this {
    this.pipeline.push({ $count: fieldName });
    return this;
  }

  addStage(stage: PipelineStage): this {
    this.pipeline.push(stage);
    return this;
  }

  reset(): this {
    this.pipeline = [];
    return this;
  }

  getPipeline(): PipelineStage[] {
    return [...this.pipeline];
  }

  async execute(): Promise<any[]> {
    const _start = Date.now();
    const res = await this.model.aggregate(this.pipeline);
    const dur = Date.now() - _start;
    const modelName =
      (this.model as any)?.modelName ||
      (this.model as any)?.collection?.name ||
      'UnknownModel';
    const pipelineSummary = summarizePipeline(this.pipeline);
    recordDbQuery(dur, {
      model: modelName,
      operation: 'aggregate',
      cacheHit: false,
      pipeline: pipelineSummary,
    });
    return res;
  }
}

// Compact summary generator for aggregation pipeline metrics logging
export function summarizePipeline(pipeline: PipelineStage[]): string {
  const parts: string[] = [];
  for (const stage of pipeline) {
    const key =
      stage && typeof stage === 'object'
        ? Object.keys(stage as any)[0]
        : undefined;
    if (!key) continue;
    const val: any = (stage as any)[key];
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
        parts.push(
          keys.length ? `$project(${keys.length} fields)` : `$project`,
        );
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

export default AggregationBuilder;
