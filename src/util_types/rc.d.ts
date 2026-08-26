type TIdx = {
    project: number,
    env: number
};
type TProject = {
    idx: number,
    id: string,
    name: string,
    domain: {
        id: string,
        name: string
    },
    env: Array<{
        idx: number,
        id: string,
        name: string,
        type: number
    }>
};
export default interface IRC {
    defaults: TIdx,
    actives: TIdx,
    projects: Array<TProject>
}
