export interface EmbeddingResponse {
    model:             string;
    embeddings:        Array<number[]>;
    total_duration:    number;
    load_duration:     number;
    prompt_eval_count: number;
}
