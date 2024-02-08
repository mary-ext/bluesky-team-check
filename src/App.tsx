import { createResource, createSelector, createSignal } from 'solid-js';

import { makeAbortable } from '@solid-primitives/resource';

import { Agent } from '@externdefs/bluesky-client/agent';
import { XRPCError } from '@externdefs/bluesky-client/xrpc-utils';

import type { DID } from '@externdefs/bluesky-client/atp-schema';

const agent = new Agent({ serviceUri: 'https://api.bsky.app' });

const EMPTY_ARRAY: never[] = [];

const members: [did: DID, handle: string][] = [
	['did:plc:3jpt2mvvsumj2r7eqk4gzzjz', 'esb.lol'],
	['did:plc:44ybard66vv44zksje25o7dz', 'bnewbold.net'],
	['did:plc:fgsn4gf2dlgnybo4nbej5b2s', 'anshnanda.com'],
	['did:plc:fpruhuo22xkm5o7ttr2ktxdo', 'danabra.mov'],
	['did:plc:l3rouwludahu3ui3bt66mfvj', 'divy.zone'],
	['did:plc:oisofpd7lj26yvgiivf3lxsi', 'haileyok.com'],
	['did:plc:oky5czdrnfjpqslsw2a5iclo', 'jay.bsky.team'],
	['did:plc:q6gjnaw2blty4crticxkmujt', 'jaz.bsky.social'],
	['did:plc:qjeavhlw222ppsre4rscd3n2', 'rose.bsky.team'],
	['did:plc:ragtjsm2j2vknwkz3zp4oxrd', 'pfrazee.com'],
	['did:plc:tl7zqgil2irwndwojsxszceb', 'jessica.bsky.team'],
	['did:plc:tpg43qhh4lw4ksiffs4nbda3', 'jacob.gold'],
	['did:plc:upo6iq6ekh66d4mbhmiy6se4', 'foysal.codes'],
	['did:plc:vjug55kidv6sye7ykr5faxxn', 'emilyliu.me'],
	['did:plc:vpkhqolt662uhesyj6nxm7ys', 'why.bsky.team'],
	['did:plc:yk4dd2qkboz2yv6tpubpc6co', 'dholms.xyz'],
];

const App = () => {
	const [signal] = makeAbortable();

	const [actor, setActor] = createSignal<string>();

	const [resource] = createResource(actor, async ($actor) => {
		const $signal = signal();

		let did: string;

		if ($actor.startsWith('did:')) {
			did = $actor;
		} else {
			const response = await agent.rpc.get('com.atproto.identity.resolveHandle', {
				signal: $signal,
				params: {
					handle: $actor,
				},
			});

			did = response.data.did;
		}

		const promises = chunked(members, 30).map((chunk) => {
			return agent.rpc.get('app.bsky.graph.getRelationships', {
				signal: $signal,
				params: {
					actor: did,
					others: chunk.map((member) => member[0]),
				},
			});
		});

		const responses = await Promise.all(promises);
		const followed = responses.flatMap((response) => {
			return mapDefined(response.data.relationships, (relation) => {
				if (relation.$type === 'app.bsky.graph.defs#relationship' && relation.followedBy) {
					return relation.did;
				}
			});
		});

		return followed;
	});

	const isFollowed = createSelector<DID[], DID>(
		() => (resource.state === 'ready' ? resource.latest : EMPTY_ARRAY),
		(did, array) => array.includes(did),
	);

	const handleSubmit = (ev: SubmitEvent & { currentTarget: HTMLFormElement }) => {
		ev.preventDefault();

		const form = new FormData(ev.currentTarget);
		const actor = (form.get('actor') as string).replace(/^@/, '');

		setActor(actor);
	};

	return (
		<div>
			<small>
				<a href="https://mary.my.id">« other bluesky stuff</a>
			</small>
			<h3>Bluesky team check</h3>
			<p>See if you've been followed by any Bluesky team members</p>

			<form onSubmit={handleSubmit} class="input-form">
				<input
					type="text"
					name="actor"
					required
					placeholder="example.bsky.social"
					pattern="@?([a-zA-Z0-9\\-]+(?:\\.[a-zA-Z0-9\\-]+)*(?:\\.[a-zA-Z]+))|did:[a-z]+:[a-zA-Z0-9._\\-]+"
					title="Bluesky handle or DID"
				/>

				<button type="submit">Go!</button>
			</form>

			<hr />

			{actor() ? (
				resource.state === 'errored' ? (
					<p>
						{(() => {
							const err = resource.error;

							if (err instanceof XRPCError) {
								return formatXRPCError(err);
							}

							return '' + err;
						})()}
					</p>
				) : resource.state === 'ready' ? (
					<>
						<p>Showing {actor()}</p>
						<div class="user-list">
							{
								/* @once */ members.map(([did, handle]) => {
									return (
										<div class="user">
											<svg class="user-status" data-followed={isFollowed(did)}>
												<use href={isFollowed(did) ? '#ic-baseline-check' : '#ic-baseline-close'} />
											</svg>
											<span class="user-handle">{handle}</span>
										</div>
									);
								})
							}
						</div>
					</>
				) : (
					<p>Loading...</p>
				)
			) : null}

			<svg>
				<symbol viewBox="0 0 24 24" id="ic-baseline-check">
					<path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19L21 7l-1.41-1.41z"></path>
				</symbol>
				<symbol viewBox="0 0 24 24" id="ic-baseline-close">
					<path
						fill="currentColor"
						d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"
					></path>
				</symbol>
			</svg>
		</div>
	);
};

export default App;

const formatXRPCError = (err: XRPCError) => {
	const name = err.name;
	return (name ? name + ': ' : '') + err.message;
};

const mapDefined = <T, R>(array: T[], mapper: (value: T) => R | undefined): R[] => {
	var mapped: R[] = [];

	var idx = 0;
	var len = array.length;
	var temp: R | undefined;

	for (; idx < len; idx++) {
		if ((temp = mapper(array[idx])) !== undefined) {
			mapped.push(temp);
		}
	}

	return mapped;
};

const chunked = <T,>(arr: T[], size: number): T[][] => {
	const chunks: T[][] = [];

	for (let i = 0, il = arr.length; i < il; i += size) {
		chunks.push(arr.slice(i, i + size));
	}

	return chunks;
};
