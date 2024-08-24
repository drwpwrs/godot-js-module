/**
 * Expose as a godot class.
 * An class object is created and attached automatically when construct an instance from this class
 */
export function gdclass<T extends godot.Object>(target: new () => T) {
	const id = (gdclass['internal_class_id'] = gdclass['internal_class_id']
		? gdclass['internal_class_id'] + 1
		: 1);
	const class_name = `AnonymousJSClass${id}`;
	godot.register_class(target, class_name);
}

/** Set the script is runable in editor */
export function tool<T extends godot.Object>(target: new () => T) {
	godot.set_script_tooled(target, true);
}

/** Set the script icon */
export function icon<T extends godot.Object>(icon) {
	return function (target: new () => T) {
		godot.set_script_icon(target, icon);
	};
}

/** Register signal to godot script */
export function signal(
	target: godot.Object | (new () => godot.Object),
	property: string,
	descriptor?: any
) {
	var constructor: Function =
		typeof target === 'function' ? target : target.constructor;
	var prototype: object = constructor.prototype;
	godot.register_signal(target, property);

	descriptor = descriptor || {};
	(descriptor as PropertyDescriptor).value = property;
	(descriptor as PropertyDescriptor).writable = false;

	Object.defineProperty(constructor, property, descriptor);
	Object.defineProperty(prototype, property, descriptor);
}

/**
 * Register property to godot class
 * @param value The default value of the property
 */
export function property<T extends godot.Object>(info: godot.PropertyInfo) {
	return function (target: T, property: string, descriptor?: any) {
		info = info || {};
		godot.register_property(target, property, info);
		return descriptor;
	};
}

/**
 * Return the node with `path` if the `_onready` is called
 * @param path The path of the node
 */
export function onready<T extends godot.Node>(
	path: string
) {
	return function (target: T, property: string, descriptor?: any) {
		const key = `$onready:${property}`;
		descriptor = descriptor || {};
		descriptor.set = function (v) {
			this[key] = v;
		};
		descriptor.get = function () {
			let v = this[key];
			if (!v) {
				v = (this as godot.Node).get_node(path);
				this[key] = v;
			}
			return v;
		};
		return descriptor;
	};
}

/**
 * Register the member as a node property
 * **Note: The value is null before current node is ready**
 * @param path The default path name of the node
 */
export function node<T extends godot.Node>(
	target: T,
	property: string,
	descriptor?: any
) {
	const key = `$onready:${property}`;
	const path_key = `${property} `; // <-- a space at the end
	descriptor = descriptor || {};
	descriptor.set = function (v) {
		this[key] = v;
	};
	descriptor.get = function () {
		let v = this[key];
		if (!v) {
			v = (this as godot.Node).get_node(this[path_key]);
			this[key] = v;
		}
		return v;
	};
	godot.register_property(target, path_key, { type: godot.TYPE_NODE_PATH });
	return descriptor;
}

/**
 * Register an enumeration property
 * @param enumeration Enumeration name list
 * @param default_value The default value of the property
 */
export function enumeration<T extends godot.Object>(
	enumeration: string[],
	default_value?: string | number
) {
	return function (target: T, property: string, descriptor?: any) {
		const pi: godot.PropertyInfo = {
			hint: godot.PropertyHint.PROPERTY_HINT_ENUM,
			type:
				typeof default_value === 'string' ? godot.TYPE_STRING : godot.TYPE_INT,
			hint_string: '',
			default: typeof default_value === 'string' ? default_value : 0,
		};
		for (let i = 0; i < enumeration.length; i++) {
			pi.hint_string += enumeration[i];
			if (i < enumeration.length - 1) {
				pi.hint_string += ',';
			}
		}
		godot.register_property(target, property, pi);
		return descriptor;
	};
}

/**
 * Configuration options for RPC methods.
 */
interface RPCConfig {
	/** The RPC mode to use. */
	mode?: godot.MultiplayerAPI.RPCMode;
	/** The transfer mode to use for the RPC. */
	transfer_mode?: godot.MultiplayerPeer.TransferMode;
	/** The transfer channel to use for the RPC. */
	transfer_channel?: number;
	/** Whether to call the method locally in addition to remotely. */
	call_local?: boolean;
}

/**
 * Decorator for RPC (Remote Procedure Call) methods.
 * This decorator configures how a method behaves when called remotely in multiplayer scenarios.
 *
 * @param config - Optional configuration object for the RPC.
 * @returns A method decorator function.
 *
 * @example
 * // Basic usage (uses default settings)
 * @rpc()
 * myMethod() { }
 *
 * @example
 * // Configuring RPC mode
 * @rpc({ mode: MultiplayerAPI.RPCMode.AUTHORITY })
 * myAuthorityMethod() { }
 *
 * @example
 * // Configuring transfer mode and local call
 * @rpc({ transfer_mode: MultiplayerPeer.TransferMode.UNRELIABLE, call_local: true })
 * myUnreliableMethod() { }
 */
export function rpc<T extends godot.Node>(config: Partial<RPCConfig> = {}) {
	return function (
		target: T,
		property: string,
		descriptor?: PropertyDescriptor
	) {
		const is_method = typeof target[property] === 'function';
		const original_ready = target._ready;
		target._ready = function (this: godot.Node) {
			if (is_method) {
				this.rpc_config(property, config);
			} else {
				console.warn('RPC decorators can only be used on methods.');
			}
			if (original_ready) return original_ready.call(this);
		};
		return descriptor;
	};
}
