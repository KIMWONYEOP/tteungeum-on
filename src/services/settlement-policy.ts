/** Contract-specific settlement policies are interchangeable; no UI contains a fee formula. */
export interface SettlementPolicy {
 version:string;
 costs(input:{storeId:string;periodStart:string;periodEnd:string;grossSales:number}):Promise<{franchiseFee:number;platformFee:number;otherFee:number;adjustment:number}>;
}
export class ReviewedFixedCostPolicy implements SettlementPolicy {
 readonly version='reviewed-fixed-cost-v1';
 constructor(private readonly reviewed:{franchiseFee:number;platformFee:number;otherFee:number;adjustment:number}){}
 async costs(){return {...this.reviewed};}
}
