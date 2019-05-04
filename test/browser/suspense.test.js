/*eslint-env browser, mocha */
/** @jsx h */
import { setupRerender } from 'preact/test-utils';
import { createElement as h, render, Component, Suspense, lazy, Fragment } from '../../src/index';
import { setupScratch, teardown } from '../_util/helpers';

class LazyComp extends Component {
	render() {
		return <div>Hello from LazyComp</div>;
	}
}

function CustomSuspense({ isDone, prom, name }) {
	if (!isDone()) {
		throw prom;
	}

	return (
		<div>
			Hello from CustomSuspense {name}
		</div>
	);
}

class Catcher extends Component {
	constructor(props) {
		super(props);
		this.state = { error: false };
	}

	componentDidCatch(e) {
		this.setState({ error: e });
	}

	render(props, state) {
		return state.error ? <div>Catcher did catch: {state.error.message}</div> : props.children;
	}
}

function createSuspension(name, timeout, t) {
	let done = false;
	const prom = new Promise((res, rej) => {
		setTimeout(() => {
			done = true;
			if (t) {
				rej(t);
			}
			else {
				res();
			}
		}, timeout);
	});

	return {
		name,
		prom,
		isDone: () => done
	};
}

const Lazy = lazy(() => new Promise((res) => {
	setTimeout(() => {
		res({ default: LazyComp });
	}, 0);
}));

const ThrowingLazy = lazy(() => new Promise((res, rej) => {
	setTimeout(() => {
		rej(new Error('Thrown in lazy\'s loader...'));
	}, 0);
}));

class WrapperOne extends Component {
	render() {
		return this.props.children;
	}
}

function tick(fn) {
	return new Promise((res) => {
		setTimeout(res, 10);
	})
		.then(fn);
}

describe('suspense', () => {
	let scratch, rerender;

	beforeEach(() => {
		scratch = setupScratch();
		rerender = setupRerender();
	});

	afterEach(() => {
		teardown(scratch);
	});

	it('should suspend when using lazy', () => {
		render(
			<Suspense fallback={<div>Suspended...</div>}>
				<Lazy />
			</Suspense>,
			scratch,
		);
		rerender();
		expect(scratch.innerHTML).to.eql(
			`<div>Suspended...</div>`
		);

		return tick(() => {
			rerender();
			expect(scratch.innerHTML).to.eql(
				`<div>Hello from LazyComp</div>`
			);
		});
	});

	it('should suspend when a promise is throw', () => {
		const s = createSuspension('regular case', 0, null);

		render(
			<Suspense fallback={<div>Suspended...</div>}>
				<WrapperOne>
					<CustomSuspense {...s} />
				</WrapperOne>
			</Suspense>,
			scratch,
		);
		// TODO: why a rerender needed here. Will this even work in the browser?!
		rerender();
		expect(scratch.innerHTML).to.eql(
			`<div>Suspended...</div>`
		);

		return tick(() => {
			rerender();
			expect(scratch.innerHTML).to.eql(
				`<div>Hello from CustomSuspense regular case</div>`
			);
		});
	});

	it('should suspend with custom error boundary', () => {
		const s = createSuspension('within error boundary', 0, null);

		render(
			<Suspense fallback={<div>Suspended...</div>}>
				<Catcher>
					<CustomSuspense {...s} />
				</Catcher>
			</Suspense>,
			scratch,
		);
		rerender();
		expect(scratch.innerHTML).to.eql(
			`<div>Suspended...</div>`
		);

		return tick(() => {
			rerender();
			expect(scratch.innerHTML).to.eql(
				`<div>Hello from CustomSuspense within error boundary</div>`
			);
		});
	});

	it('should support throwing suspense', () => {
		const s = createSuspension('throwing', 0, new Error('Thrown in suspense'));

		render(
			<Suspense fallback={<div>Suspended...</div>}>
				<Catcher>
					<CustomSuspense {...s} />
				</Catcher>
			</Suspense>,
			scratch,
		);
		rerender();
		expect(scratch.innerHTML).to.eql(
			`<div>Suspended...</div>`
		);

		return tick(() => {
			rerender();
			expect(scratch.innerHTML).to.eql(
				`<div>Hello from CustomSuspense throwing</div>`
			);
		});
	});

	it('should call multiple suspending components render in one go', () => {
		const s1 = createSuspension('first', 0, null);
		const s2 = createSuspension('second', 0, null);
		const LoggedCustomSuspense = sinon.spy(CustomSuspense);

		render(
			<Suspense fallback={<div>Suspended...</div>}>
				<Catcher>
					{/* Adding a <div> here will make things work... */}
					<LoggedCustomSuspense {...s1} />
					<LoggedCustomSuspense {...s2} />
				</Catcher>
			</Suspense>
			,
			scratch,
		);
		expect(LoggedCustomSuspense).to.have.been.calledTwice;
		rerender();
		expect(scratch.innerHTML).to.eql(
			`<div>Suspended...</div>`
		);

		return tick(() => {
			rerender();
			expect(scratch.innerHTML).to.eql(
				`<div>Hello from CustomSuspense first</div><div>Hello from CustomSuspense second</div>`
			);
		});
	});

	it('should call multiple nested suspending components render in one go', () => {
		const s1 = createSuspension('first', 0, null);
		const s2 = createSuspension('second', 0, null);
		const LoggedCustomSuspense = sinon.spy(CustomSuspense);

		render(
			<Suspense fallback={<div>Suspended...</div>}>
				<Catcher>
					{/* Adding a <div> here will make things work... */}
					<LoggedCustomSuspense {...s1} />
					<div>
						<LoggedCustomSuspense {...s2} />
					</div>
				</Catcher>
			</Suspense>
			,
			scratch,
		);
		expect(LoggedCustomSuspense).to.have.been.calledTwice;
		rerender();
		expect(scratch.innerHTML).to.eql(
			`<div>Suspended...</div>`
		);

		return tick(() => {
			rerender();
			expect(scratch.innerHTML).to.eql(
				`<div>Hello from CustomSuspense first</div><div><div>Hello from CustomSuspense second</div></div>`
			);
		});
	});

	it('should support suspension nested in a Fragment', () => {
		const s = createSuspension('nested in a Fragment', 0, null);

		render(
			<Suspense fallback={<div>Suspended...</div>}>
				<Catcher>
					<Fragment>
						<CustomSuspense {...s} />
					</Fragment>
				</Catcher>
			</Suspense>
			,
			scratch,
		);
		rerender();
		expect(scratch.innerHTML).to.eql(
			`<div>Suspended...</div>`
		);

		return tick(() => {
			rerender();
			expect(scratch.innerHTML).to.eql(
				`<div>Hello from CustomSuspense nested in a Fragment</div>`
			);
		});
	});

	it('should only suspend the most inner Suspend', () => {
		const s = createSuspension('1', 0, new Error('Thrown in suspense'));

		render(
			<Suspense fallback={<div>Suspended... 1</div>}>
				Not suspended...
				<Suspense fallback={<div>Suspended... 2</div>}>
					<Catcher>
						<CustomSuspense {...s} />
					</Catcher>
				</Suspense>
			</Suspense>,
			scratch,
		);
		rerender();
		expect(scratch.innerHTML).to.eql(
			`Not suspended...<div>Suspended... 2</div>`
		);

		return tick(() => {
			rerender();
			expect(scratch.innerHTML).to.eql(
				`Not suspended...<div>Hello from CustomSuspense 1</div>`
			);
		});
	});

	it('should throw when missing Suspense', () => {
		const s = createSuspension('1', 0, null);

		render(
			<Catcher>
				<CustomSuspense {...s} />
			</Catcher>,
			scratch,
		);
		rerender();
		expect(scratch.innerHTML).to.eql(
			`<div>Catcher did catch: Missing Suspense</div>`
		);
	});

	it('should throw when lazy\'s loader throws', () => {
		render(
			<Suspense fallback={<div>Suspended...</div>}>
				<Catcher>
					<ThrowingLazy />
				</Catcher>
			</Suspense>,
			scratch,
		);
		rerender();
		expect(scratch.innerHTML).to.eql(
			`<div>Suspended...</div>`
		);

		return tick(() => {
			rerender();
			expect(scratch.innerHTML).to.eql(
				`<div>Catcher did catch: Thrown in lazy's loader...</div>`
			);
		});
	});
});
