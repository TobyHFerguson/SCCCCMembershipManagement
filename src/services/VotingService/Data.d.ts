
declare namespace VotingService.Data {
    function getFiddlerForValidResults(triggerId: string): Fiddler<Result>;
    function getVoters_(election: VotingService.Election): string[];
    function hasVotedAlreadyInThisElection(email: string, election: VotingService.Election): boolean;
    function storeElectionData(elections: VotingService.Election[]): void;
    function getElectionData(): VotingService.Election[];
    function getFiddler_(): Fiddler<VotingService.Election>;
}